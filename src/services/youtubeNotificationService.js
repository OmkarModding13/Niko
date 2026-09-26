import axios from 'axios';
import { logger } from '../utils/logger.js';

export const YOUTUBE_CHANNEL_ID = 'UCrJzDiZ5DIdwW_swG5_RrEw';
export const DISCORD_CHANNEL_ID = '1530876980873007175';
export const YOUTUBE_WEBHOOK_PATH = '/youtube/webhook';

function getWebhookBaseUrl() {
    const configuredUrl =
        process.env.YOUTUBE_WEBHOOK_URL ||
        process.env.PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN
            ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN
            : '');

    if (!configuredUrl) {
        return null;
    }

    try {
        const url = new URL(configuredUrl);
        url.pathname = '';
        url.search = '';
        url.hash = '';

        if (url.protocol !== 'https:') {
            logger.warn(
                'YouTube notifications disabled: webhook URL must use HTTPS.'
            );
            return null;
        }

        return url.toString().replace(/\/$/, '');
    } catch {
        logger.warn(
            'YouTube notifications disabled: invalid webhook URL configured.'
        );
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

export async function subscribeToYouTube() {
    const baseUrl = getWebhookBaseUrl();

    if (!baseUrl) {
        logger.warn(
            'YouTube notifications disabled: no public HTTPS webhook URL is available. ' +
            'Set YOUTUBE_WEBHOOK_URL when not running on a platform that provides RAILWAY_PUBLIC_DOMAIN.'
        );
        return false;
    }

    const callback = baseUrl + YOUTUBE_WEBHOOK_PATH;

    logger.info('YouTube webhook callback: ' + callback);

    const params = new URLSearchParams({
        'hub.callback': callback,
        'hub.mode': 'subscribe',
        'hub.topic':
            'https://www.youtube.com/feeds/videos.xml?channel_id=' +
            YOUTUBE_CHANNEL_ID,
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
            'YouTube push subscription requested: HTTP ' + response.status
        );
        logger.info(
            'YouTube channel subscription active for: ' +
            YOUTUBE_CHANNEL_ID
        );

        return true;
    } catch (error) {
        logger.error(
            'YouTube subscription failed:',
            error?.response?.data ||
            error?.message ||
            error
        );
        return false;
    }
}

export function verifyYouTube(req, res) {
    const challenge = req.query['hub.challenge'];
    const mode = req.query['hub.mode'];

    if (challenge) {
        logger.info(
            '[YouTube] Verification request received: ' + (mode || 'unknown')
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
        '[YouTube] Push notification received. Content-Type=' +
        (req.headers['content-type'] || 'unknown') +
        ', bodyLength=' +
        body.length
    );

    if (!body) {
        logger.warn('[YouTube] Ignored empty push notification.');
        return res.status(204).send();
    }

    // YouTube sends an Atom feed. Restrict parsing to <entry> so the
    // feed-level <title> ("YouTube video feed") is not mistaken for
    // the actual video title.
    const entry =
        body.match(/<entry\b[^>]*>([\\s\\S]*?)<\\/entry>/i)?.[1] ||
        body;

    const channel =
        entry.match(
            /<yt:channelId\b[^>]*>([^<]+)<\\/yt:channelId>/i
        );

    const video =
        entry.match(
            /<yt:videoId\b[^>]*>([^<]+)<\\/yt:videoId>/i
        );

    const title =
        entry.match(
            /<title\b[^>]*>([\\s\\S]*?)<\\/title>/i
        );

    if (
        !channel ||
        channel[1].trim() !== YOUTUBE_CHANNEL_ID ||
        !video
    ) {
        logger.warn(
            '[YouTube] Ignored notification: channel/video ID did not match.'
        );
        return res.status(204).send();
    }

    const videoId = video[1].trim();
    const videoTitle =
        decodeXmlText(title?.[1] || 'New YouTube Video');

    logger.info(
        '[YouTube] New video detected: ' + videoId
    );

    try {
        const target =
            await bot.channels.fetch(
                DISCORD_CHANNEL_ID
            );

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
            videoId;

        await target.send({
            content:
                (role
                    ? '<@&' + role.id + '> '
                    : '') +
                'Hollow Devil has released a new video!\n' +
                url,
            embeds: [{
                author: {
                    name: 'Hollow Devil'
                },
                title: videoTitle,
                url,
                color: 0x2f8cff,
                image: {
                    url:
                        'https://i.ytimg.com/vi/' +
                        videoId +
                        '/maxresdefault.jpg'
                }
            }]
        });

        logger.info(
            '[YouTube] Discord notification sent successfully for video ' +
            videoId
        );
    } catch (error) {
        logger.error(
            '[YouTube] Failed to send Discord notification:',
            error
        );
    }

    return res.status(204).send();
}
