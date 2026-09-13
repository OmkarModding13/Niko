import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { refreshAutoBanEmbed } from './autoBan.js';

export default {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        try {
            logger.info(`Logged in as ${client.user.tag}`);

            for (const guild of client.guilds.cache.values()) {
                await refreshAutoBanEmbed(client, guild);
            }
        } catch (error) {
            logger.error('Error in ready event:', error);
        }
    }
};
