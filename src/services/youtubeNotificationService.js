import axios from 'axios';
import { logger } from '../utils/logger.js';

export const YOUTUBE_CHANNEL_ID = 'UCrJzDiZ5DIdwW_swG5_RrEw';
export const DISCORD_CHANNEL_ID = '1530876980873007175';
export const YOUTUBE_WEBHOOK_PATH = '/youtube/webhook';

const YOUTUBE_FEED_URL =
    'https://www.youtube.com/feeds/videos.xml?channel_id=' +
    YOUTUBE_CHANNEL_ID;

let lastKnownVideoId = null;
const notifiedVideoIds = new Set();

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
    const entry =
        body.match(/<entry\b[^>]*>([\s\S]*?)<\/entry>/i)?.[1];

    if (!entry) return null;

    const channelId =
        entry.match(/<yt:channelId\b[^>]*>([^<]+)<\/yt:channelId>/i)?.[1]?.trim();

    const videoId =
        entry.match(/<yt:videoId\b[^>]*>([^<]+)<\/yt:videoId>/i)?.[1]?.trim();

    const title =
        entry.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];

    const published =
        entry.match(/<published\b[^>]*>([^<]+)<\/published>/i)?.[1]?.trim();

    if (!channelId || !videoId) return null;

    return {
        channelId,
        videoId,
        title: decodeXmlText(title || 'New YouTube Video'),
        published: published || null
    };
}

async function sendYouTubeNotification(bot, video) {
    if (
        !video ||
        video.channelId !== YOUTUBE_CHANNEL_ID ||
        !video.videoId
    ) {
        return false;
    }

    if (notifiedVideoIds.has(video.videoId)) {
        return false;
    }

    notifiedVideoIds.add(video.videoId);

    try {
        const target = await bot.channels.fetch(DISCORD_CHANNEL_ID);

        if (!target?.isTextBased()) {
            throw new Error(
                'Notification channel unavailable or is not text-based.'
            );
        }

        const role =
            target.guild?.roles?.cache?.find(
                role =>
                    role.name.toLowerCase().startsWith('newborn')
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

        logger.info(
            '[YouTube] Discord notification sent successfully: ' +
            video.videoId
        );

        return true;
    } catch (error) {
        // Do not permanently mark the video as delivered if Discord failed.
        notifiedVideoIds.delete(video.videoId);

        logger.error(
            '[YouTube] Failed to send Discord notification:',
            error
        );

        return false;
    }
}

export async function subscribeToYouTube() {
    const baseUrl = getWebhookBaseUrl();

    if (!baseUrl) {
        logger.warn(
            '[YouTube] Webhook disabled: no public HTTPS URL. RSS fallback remains active.'
        );
        return false;
    }

    const callback = baseUrl + YOUTUBE_WEBHOOK_PATH;

    logger.info('[YouTube] Webhook callback: ' + callback);

    const params = new URLSearchParams({
        'hub.callback': callback,
        'hub.mode': 'subscribe',
        'hub.topic': YOUTUBE_FEED_URL,
        'hub.verify': 'sync',
        'hub.lease_seconds': '864000'
    });

    try {
        const response = await axios.post(
            'https://pubsubhubbub.appspot.com/subscribe',
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000,
                validateStatus: status => status >= 200 && status < 300
            }
        );

        logger.info(
            '[YouTube] Push subscription requested: HTTP ' +
            response.status
        );

        return true;
    } catch (error) {
        logger.error(
            '[YouTube] Push subscription failed; RSS fallback remains active:',
            error?.response?.data || error?.message || error
        );

        return false;
    }
}

export async function initializeYouTubeFeed(bot) {
    try {
        const response = await axios.get(YOUTUBE_FEED_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'NikoBot/2.1 YouTube notifier'
            }
        });

        const latest = parseFeed(response.data);

        if (!latest) {
            throw new Error('Could not parse YouTube channel feed.');
        }

        if (latest.channelId !== YOUTUBE_CHANNEL_ID) {
            throw new Error('YouTube feed channel ID mismatch.');
        }

        lastKnownVideoId = latest.videoId;

        logger.info(
            '[YouTube] RSS fallback initialized. Latest video: ' +
            latest.videoId
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

export async function checkYouTubeFeed(bot) {
    try {
        const response = await axios.get(YOUTUBE_FEED_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'NikoBot/2.1 YouTube notifier'
            }
        });

        const latest = parseFeed(response.data);

        if (!latest || latest.channelId !== YOUTUBE_CHANNEL_ID) {
            logger.warn('[YouTube] RSS fallback received an invalid feed.');
            return false;
        }

        if (!lastKnownVideoId) {
            lastKnownVideoId = latest.videoId;
            return false;
        }

        if (latest.videoId === lastKnownVideoId) {
            return false;
        }

        lastKnownVideoId = latest.videoId;

        logger.info(
            '[YouTube] RSS fallback detected new video: ' +
            latest.videoId
        );

        await sendYouTubeNotification(bot, latest);
        return true;
    } catch (error) {
        logger.error(
            '[YouTube] RSS fallback check failed:',
            error?.message || error
        );
        return false;
    }
}

export function verifyYouTube(req, res) {
    const challenge = req.query['hub.challenge'];
    const mode = req.query['hub.mode'];

    if (challenge) {
        logger.info(
            '[YouTube] Verification request received: ' +
            (mode || 'unknown')
        );

        return res
            .status(200)
            .type('text/plain')
            .send(challenge);
    }

    logger.warn('[YouTube] Invalid verification request received.');

    return res
        .status(400)
        .send('Invalid verification request.');
}

export async function handleYouTubeNotification(req, res, bot) {
    const body =
        typeof req.body === 'string'
            ? req.body
            : '';

    logger.info(
        '[YouTube] Push notification received. bodyLength=' +
        body.length
    );

    const video = parseFeed(body);

    if (
        !video ||
        video.channelId !== YOUTUBE_CHANNEL_ID
    ) {
        logger.warn(
            '[YouTube] Ignored push notification: invalid channel/video.'
        );

        return res.status(204).send();
    }

    logger.info(
        '[YouTube] Push detected video: ' +
        video.videoId
    );

    await sendYouTubeNotification(bot, video);

    return res.status(204).send();
}
