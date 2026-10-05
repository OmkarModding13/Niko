import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Check how long the bot has been online'),

    async execute(interaction) {
        try {
            let totalSeconds = Math.max(0, interaction.client.uptime / 1000);
            const days = Math.floor(totalSeconds / 86400);
            totalSeconds %= 86400;
            const hours = Math.floor(totalSeconds / 3600);
            totalSeconds %= 3600;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = Math.floor(totalSeconds % 60);
            const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            await interaction.reply({
                embeds: [createEmbed({
                    title: 'System Uptime',
                    description: `\`\`\`${uptimeStr}\`\`\``,
                })],
            });
        } catch (error) {
            logger.error('Uptime command error:', error);
        }
    },
};