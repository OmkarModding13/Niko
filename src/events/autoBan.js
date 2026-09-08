import { PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';

const AUTO_BAN_CHANNEL_ID = '1530876980873007178';

export default {
    name: 'messageCreate',

    async execute(message) {
        // Ignore bots
        if (message.author.bot) return;

        // Only work in the Auto-Ban channel
        if (message.channel.id !== AUTO_BAN_CHANNEL_ID) return;

        try {
            // Delete the message first
            await message.delete();

            // Ban the member
            if (message.member?.bannable) {
                await message.member.ban({
                    reason: 'Sent a message in the Anti-Bot / Auto-Ban channel.'
                });

                logger.info(
                    `[Auto-Ban] Banned ${message.author.tag} for messaging in Auto-Ban channel.`
                );
            } else {
                logger.warn(
                    `[Auto-Ban] Could not ban ${message.author.tag}. Missing permission or member is not bannable.`
                );
            }
        } catch (error) {
            logger.error('[Auto-Ban] Failed to delete message or ban member:', error);
        }
    }
};
