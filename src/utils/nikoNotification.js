import { EmbedBuilder } from 'discord.js';

const NIKO_NOTIFICATIONS_CHANNEL_ID = '1550119194811572244';
const EMBED_BLUE = 0x168BFF;

/**
 * Send an important Niko notification to the dedicated notification channel.
 * Returns true when the notification was sent successfully.
 */
export async function sendNikoNotification(client, user, title, description) {
    try {
        const channel = await client.channels.fetch(NIKO_NOTIFICATIONS_CHANNEL_ID).catch(() => null);

        if (!channel?.isTextBased()) {
            return false;
        }

        const embed = new EmbedBuilder()
            .setColor(EMBED_BLUE)
            .setTitle(`🔔 ${title}`)
            .setDescription(description)
            .setFooter({ text: 'Niko • Notification' })
            .setTimestamp();

        await channel.send({
            content: `<@${user.id}>`,
            embeds: [embed],
        });

        return true;
    } catch (error) {
        console.error('[Niko Notification] Failed to send notification:', error);
        return false;
    }
}

export { NIKO_NOTIFICATIONS_CHANNEL_ID };
