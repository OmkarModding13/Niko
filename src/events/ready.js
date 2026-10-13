import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { refreshAutoBanEmbed } from './autoBan.js';
import { getGuildConfig } from '../services/config/guildConfig.js';

export default {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        try {
            logger.info(`Logged in as ${client.user.tag}`);

            // Explicitly publish an online presence after login. A configured
            // presence elsewhere is not applied automatically by discord.js.
            client.user.setPresence({
                status: 'online',
                activities: [{ name: 'stalking', type: 3 }],
            });
            logger.info('[Presence] Set Niko status to online');

            const guilds = [...client.guilds.cache.values()];
            logger.info(`[Ready] Niko is connected to ${guilds.length} guild(s): ${guilds.map(guild => guild.id).join(', ') || 'none'}`);

            // Warm configuration cache and refresh auto-ban panels in parallel.
            // This keeps the first real message/command from paying the initial
            // PostgreSQL guild-config round trip.
            await Promise.allSettled([
                ...guilds.map((guild) =>
                    refreshAutoBanEmbed(client, guild)
                ),
                ...guilds.map((guild) =>
                    getGuildConfig(client, guild.id)
                ),
            ]);
        } catch (error) {
            logger.error('Error in ready event:', error);
        }
    }
};
