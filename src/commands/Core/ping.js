import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Checks the bot's latency and API speed"),

    async prefixExecute(interaction) {
        try {
            const startTime = Date.now();
            const pingingMessage = await interaction.reply({ content: 'Pinging...' });
            const latency = Date.now() - startTime;
            const apiLatency = Math.max(0, Math.round(interaction.client.ws.ping));
            const embed = createEmbed({ title: 'Pong!', description: null }).addFields(
                { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true },
            );
            await pingingMessage.edit({ content: null, embeds: [embed] });
        } catch (error) {
            logger.error('Ping prefix command error:', error);
        }
    },

    async execute(interaction) {
        try {
            const latency = Math.max(0, Date.now() - interaction.createdTimestamp);
            const apiLatency = Math.max(0, Math.round(interaction.client.ws.ping));
            const embed = createEmbed({ title: 'Pong!', description: null }).addFields(
                { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true },
            );
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Ping command error:', error);
        }
    },
};