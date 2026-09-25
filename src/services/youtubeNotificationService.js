import axios from 'axios';

export const YOUTUBE_CHANNEL_ID = 'UCrJzDiZ5DIdwW_swG5_RrEw';
export const DISCORD_CHANNEL_ID = '1530876980873007175';
export const YOUTUBE_WEBHOOK_PATH = '/youtube/webhook';

export async function subscribeToYouTube(logger) {
    const baseUrl = process.env.YOUTUBE_WEBHOOK_URL || process.env.PUBLIC_URL;
    if (!baseUrl) return false;
    const callback = baseUrl.replace(/\/$/, '') + YOUTUBE_WEBHOOK_PATH;
    if (!callback.startsWith('https://')) return false;
    const params = new URLSearchParams({
        'hub.callback': callback,
        'hub.mode': 'subscribe',
        'hub.topic': 'https://www.youtube.com/feeds/videos.xml?channel_id=' + YOUTUBE_CHANNEL_ID,
        'hub.verify': 'async',
        'hub.lease_seconds': '864000'
    });
    try {
        const response = await axios.post('https://pubsubhubbub.appspot.com/subscribe', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
        });
        logger.info('YouTube push subscription requested: HTTP ' + response.status);
        return true;
    } catch (error) {
        logger.error('YouTube subscription failed:', error?.response?.data || error?.message || error);
        return false;
    }
}

export function verifyYouTube(req, res) {
    const challenge = req.query['hub.challenge'];
    if (challenge) return res.status(200).type('text/plain').send(challenge);
    return res.status(400).send('Invalid verification request.');
}

export async function handleYouTubeNotification(req, res, bot) {
    const body = typeof req.body === 'string' ? req.body : '';
    const channel = body.match(/<yt:channelId>([^<]+)<\/yt:channelId>/i);
    const video = body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i);
    const title = body.match(/<title>([\s\S]*?)<\/title>/i);
    if (!channel || channel[1] !== YOUTUBE_CHANNEL_ID || !video) return res.status(204).send();
    const videoId = video[1];
    const videoTitle = (title?.[1] || 'New YouTube Video').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    try {
        const target = await bot.channels.fetch(DISCORD_CHANNEL_ID);
        if (!target?.isTextBased()) throw new Error('Notification channel unavailable.');
        const role = target.guild?.roles?.cache?.find(r => r.name.toLowerCase().startsWith('newborn'));
        const url = 'https://www.youtube.com/watch?v=' + videoId;
        await target.send({
            content: (role ? '<@&' + role.id + '> ' : '') + 'Hollow Devil has released a new video!\n' + url,
            embeds: [{ author: { name: 'Hollow Devil' }, title: videoTitle, url, color: 0x2f8cff, image: { url: 'https://i.ytimg.com/vi/' + videoId + '/maxresdefault.jpg' } }]
        });
    } catch (error) {
        bot.logger?.error?.('Failed to send YouTube notification:', error);
    }
    return res.status(204).send();
}
