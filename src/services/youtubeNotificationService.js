import axios from 'axios';
import { logger, startupLog } from '../utils/logger.js';

export const YOUTUBE_CHANNEL_ID =
    process.env.YOUTUBE_CHANNEL_ID ||
    'UCrJzDiZ5DIdwW_swG5_RrEw';

export const DISCORD_CHANNEL_ID =
    process.env.YOUTUBE_DISCORD_CHANNEL_ID ||
    '1530876980873007175';

export const YOUTUBE_WEBHOOK_PATH = '/youtube/webhook';

const YOUTUBE_FEED_URL =
    'https://www.youtube.com/feeds/videos.xml?channel_id=' +
    encodeURIComponent(YOUTUBE_CHANNEL_ID);

const YOUTUBE_SHORTS_FEED_URL =
    'https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH' +
    encodeURIComponent(YOUTUBE_CHANNEL_ID.slice(2));

const STATE_KEY = 'youtube:notification:state';
const STATE_VERSION = 3;
const MAX_REMEMBERED_VIDEO_IDS = 100;

let state = {
    version: STATE_VERSION,
    lastKnownVideoId: null,
    lastKnownShortId: null,
    notifiedVideoIds: []
};

let stateLoaded = false;
let feedCheckInProgress = false;
let subscriptionInProgress = false;

function getWebhookBaseUrl() {
    const configuredUrl =
        process.env.YOUTUBE_WEBHOOK_URL ||
        process.env.PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN
            ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN
            : '');

    if (!configuredUrl) return null;

    try {
        const url = new URL(configuredUrl);
        url.pathname = '';
        url.search = '';
        url.hash = '';

        if (url.protocol !== 'https:') {
            logger.warn('[YouTube] Webhook URL must use HTTPS.');
            return null;
        }

        return url.toString().replace(/\/$/, '');
    } catch {
        logger.warn('[YouTube] Invalid webhook URL configured.');
        return null;
    }
}

function decodeXmlText(value = '') {
    return value
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();
}

function parseFeed(body) {
    const entries = [
        ...(body.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) || [])
    ];

    return entries
        .map(entry => {
            const channelId =
                entry.match(
                    /<yt:channelId\b[^>]*>([^<]+)<\/yt:channelId>/i
                )?.[1]?.trim();

            const videoId =
                entry.match(
                    /<yt:videoId\b[^>]*>([^<]+)<\/yt:videoId>/i
                )?.[1]?.trim();

            const title =
                entry.match(
                    /<title\b[^>]*>([\s\S]*?)<\/title>/i
                )?.[1];

            const published =
                entry.match(
                    /<published\b[^>]*>([^<]+)<\/published>/i
                )?.[1]?.trim();

            if (!channelId || !videoId) {
                return null;
            }

            return {
                channelId,
                videoId,
                title: decodeXmlText(title || 'New YouTube Video'),
                published: published || null
            };
        })
        .filter(Boolean)
        .filter(video => video.channelId === YOUTUBE_CHANNEL_ID)
        .sort((a, b) => {
            const aTime = Date.parse(a.published || '') || 0;
            const bTime = Date.parse(b.published || '') || 0;
            return aTime - bTime;
        });
}

function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') {
        return {
            version: STATE_VERSION,
            lastKnownVideoId: null,
            lastKnownShortId: null,
            notifiedVideoIds: []
        };
    }

    return {
        version: STATE_VERSION,
        lastKnownVideoId:
            typeof raw.lastKnownVideoId === 'string'
                ? raw.lastKnownVideoId
                : null,
        lastKnownShortId:
            typeof raw.lastKnownShortId === 'string'
                ? raw.lastKnownShortId
                : null,
        notifiedVideoIds:
            Array.isArray(raw.notifiedVideoIds)
                ? raw.notifiedVideoIds
                    .filter(id => typeof id === 'string')
                    .slice(-MAX_REMEMBERED_VIDEO_IDS)
                : []
    };
}

async function loadState(bot) {
    if (stateLoaded) return state;

    try {
        const stored = await bot?.db?.get?.(STATE_KEY, null);
        state = normalizeState(stored);
    } catch (error) {
        logger.warn(
            '[YouTube] Could not load persistent notification state:',
            error?.message || error
        );
    }

    stateLoaded = true;
    return state;
}

async function saveState(bot) {
    try {
        await bot?.db?.set?.(STATE_KEY, {
            ...state,
            version: STATE_VERSION,
            notifiedVideoIds:
                state.notifiedVideoIds.slice(-MAX_REMEMBERED_VIDEO_IDS)
        });
    } catch (error) {
        logger.error(
            '[YouTube] Failed to persist notification state:',
            error?.message || error
        );
    }
}

function wasNotified(videoId) {
    return state.notifiedVideoIds.includes(videoId);
}

async function markNotified(bot, videoId) {
    if (!wasNotified(videoId)) {
        state.notifiedVideoIds.push(videoId);
    }

    state.notifiedVideoIds =
        state.notifiedVideoIds.slice(-MAX_REMEMBERED_VIDEO_IDS);

    await saveState(bot);
}

async function sendYouTubeNotification(bot, video) {
    if (
        !video ||
        video.channelId !== YOUTUBE_CHANNEL_ID ||
        !video.videoId
    ) {
        return false;
    }

    await loadState(bot);

    if (wasNotified(video.videoId)) {
        return true;
    }

    try {
        const target =
            await bot.channels.fetch(DISCORD_CHANNEL_ID);

        if (!target?.isTextBased()) {
            throw new Error(
                'Notification channel unavailable or is not text-based.'
            );
        }

        const role =
            target.guild?.roles?.cache?.find(
                role =>
                    role.name
                        .toLowerCase()
                        .startsWith('newborn')
            );

        const url =
            'https://www.youtube.com/watch?v=' +
            video.videoId;

        await target.send({
            content:
                (role ? '<@&' + role.id + '> ' : '') +
                'Hollow Devil has released a new video!\n' +
                url,
            embeds: [{
                author: { name: 'Hollow Devil' },
                title: video.title,
                url,
                color: 0x2f8cff,
                image: {
                    url:
                        'https://i.ytimg.com/vi/' +
                        video.videoId +
                        '/maxresdefault.jpg'
                }
            }]
        });

        await markNotified(bot, video.videoId);

        logger.info(
            '[YouTube] Discord notification sent successfully: ' +
            video.videoId
        );

        return true;
    } catch (error) {
        logger.error(
            '[YouTube] Failed to send Discord notification:',
            error?.message || error
        );

        return false;
    }
}

export async function subscribeToYouTube() {
    if (subscriptionInProgress) {
        return false;
    }

    subscriptionInProgress = true;

    try {
        const baseUrl = getWebhookBaseUrl();

        if (!baseUrl) {
            logger.warn(
                '[YouTube] Webhook disabled: no public HTTPS URL. RSS fallback remains active.'
            );
            return false;
        }

        const callback =
            baseUrl + YOUTUBE_WEBHOOK_PATH;

        const params = new URLSearchParams({
            'hub.callback': callback,
            'hub.mode': 'subscribe',
            'hub.topic': YOUTUBE_FEED_URL,
            'hub.verify': 'sync',
            'hub.lease_seconds': '864000'
        });

        const response = await axios.post(
            'https://pubsubhubbub.appspot.com/subscribe',
            params.toString(),
            {
                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded'
                },
                timeout: 15000,
                validateStatus:
                    status =>
                        status >= 200 &&
                        status < 300
            }
        );

        startupLog(
            '[YouTube] Push subscription active: ' +
            callback
        );

        logger.info(
            '[YouTube] Push subscription requested: HTTP ' +
            response.status
        );

        return true;
    } catch (error) {
        logger.error(
            '[YouTube] Push subscription failed; RSS fallback remains active:',
            error?.response?.data ||
            error?.message ||
            error
        );

        return false;
    } finally {
        subscriptionInProgress = false;
    }
}

async function fetchYouTubeFeed(url) {
    const response =
        await axios.get(
            url,
            {
                timeout: 15000,
                headers: {
                    'User-Agent':
                        'NikoBot/2.1 YouTube notifier'
                }
            }
        );

    return parseFeed(response.data);
}

export async function initializeYouTubeFeed(bot) {
    await loadState(bot);

    try {
        const [videos, shorts] =
            await Promise.all([
                fetchYouTubeFeed(YOUTUBE_FEED_URL),
                fetchYouTubeFeed(YOUTUBE_SHORTS_FEED_URL)
            ]);

        if (videos.length === 0 && shorts.length === 0) {
            throw new Error(
                'Could not parse any YouTube feed entries.'
            );
        }

        if (!state.lastKnownVideoId && videos.length > 0) {
            state.lastKnownVideoId =
                videos[videos.length - 1].videoId;
        }

        if (!state.lastKnownShortId && shorts.length > 0) {
            state.lastKnownShortId =
                shorts[shorts.length - 1].videoId;
        }

        await saveState(bot);

        startupLog(
            '[YouTube] RSS fallback ready. Latest video: ' +
            (state.lastKnownVideoId || 'none') +
            ' | Latest short: ' +
            (state.lastKnownShortId || 'none')
        );

        return true;
    } catch (error) {
        logger.error(
            '[YouTube] RSS fallback initialization failed:',
            error?.message || error
        );
        return false;
    }
}

async function processFeed(bot, videos, cursorKey) {
    if (videos.length === 0) {
        return false;
    }

    const latest = videos[videos.length - 1];
    const previousCursor = state[cursorKey];

    if (!previousCursor) {
        state[cursorKey] = latest.videoId;
        await saveState(bot);
        return false;
    }

    const previousIndex =
        videos.findIndex(
            video =>
                video.videoId === previousCursor
        );

    // If the cursor disappeared from the feed, it means the feed rotated
    // past the previously-seen item (the feed is limited to recent entries).
    // Do NOT treat every unnotified item as new, because that can replay a
    // batch of old uploads after a restart or feed rotation.
    if (previousIndex < 0) {
        state[cursorKey] = latest.videoId;
        await saveState(bot);

        logger.warn(
            '[YouTube] Feed cursor no longer present; re-baselined without replaying old entries: ' +
            latest.videoId
        );

        return false;
    }

    const newVideos =
        videos.slice(previousIndex + 1);

    if (newVideos.length === 0) {
        return false;
    }

    let delivered = false;

    for (const video of newVideos) {
        logger.warn(
            '[YouTube] New upload detected: ' +
            video.videoId
        );

        const sent =
            await sendYouTubeNotification(
                bot,
                video
            );

        delivered =
            delivered || sent;

        if (sent) {
            state[cursorKey] =
                video.videoId;

            await saveState(bot);
        } else {
            // Keep the cursor unchanged so a failed notification is retried
            // on the next polling cycle.
            break;
        }
    }

    return delivered;
}

export async function checkYouTubeFeed(bot) {
    if (feedCheckInProgress) {
        return false;
    }

    feedCheckInProgress = true;

    try {
        await loadState(bot);

        const [videos, shorts] =
            await Promise.all([
                fetchYouTubeFeed(YOUTUBE_FEED_URL),
                fetchYouTubeFeed(YOUTUBE_SHORTS_FEED_URL)
            ]);

        const videoResult =
            await processFeed(
                bot,
                videos,
                'lastKnownVideoId'
            );

        const shortResult =
            await processFeed(
                bot,
                shorts,
                'lastKnownShortId'
            );

        return videoResult || shortResult;
    } catch (error) {
        logger.error(
            '[YouTube] RSS fallback check failed:',
            error?.message || error
        );
        return false;
    } finally {
        feedCheckInProgress = false;
    }
}

export function verifyYouTube(req, res) {
    const challenge =
        req.query['hub.challenge'];

    const mode =
        req.query['hub.mode'];

    const topic =
        req.query['hub.topic'];

    if (
        challenge &&
        (!topic ||
            topic === YOUTUBE_FEED_URL)
    ) {
        startupLog(
            '[YouTube] WebSub verification received: ' +
            (mode || 'unknown')
        );

        return res
            .status(200)
            .type('text/plain')
            .send(challenge);
    }

    logger.warn(
        '[YouTube] Invalid WebSub verification request.'
    );

    return res
        .status(400)
        .send(
            'Invalid verification request.'
        );
}

export async function handleYouTubeNotification(
    req,
    res,
    bot
) {
    const body =
        typeof req.body === 'string'
            ? req.body
            : '';

    if (!body) {
        return res
            .status(204)
            .send();
    }

    const videos =
        parseFeed(body);

    if (videos.length === 0) {
        logger.warn(
            '[YouTube] Push notification contained no valid video entry.'
        );

        return res
            .status(204)
            .send();
    }

    let sent = false;

    for (const video of videos) {
        if (
            video.channelId !==
            YOUTUBE_CHANNEL_ID
        ) {
            continue;
        }

        logger.warn(
            '[YouTube] Push detected video: ' +
            video.videoId
        );

        const delivered =
            await sendYouTubeNotification(
                bot,
                video
            );

        sent =
            sent || delivered;

        if (delivered) {
            state.lastKnownVideoId =
                video.videoId;
            await saveState(bot);
        }
    }

    return res
        .status(204)
        .send();
}

export async function renewYouTubeSubscription() {
    return subscribeToYouTube();
}
