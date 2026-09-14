import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import {
    GAME_CONFIG,
    playGame,
    resultText,
    balanceFooter,
} from './modules/gameEngine.js';

const SYMBOLS = ['💀', '👿', '🔥', '🌑', '⚔️', '💎'];

function spinSlots() {
    return Array.from({ length: 3 }, () =>
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    );
}

export default {
    data: new SlashCommandBuilder()
        .setName('soulslots')
        .setDescription('Spin the Soul Slots for Souls or a rare Shard.'),

    async execute(interaction, config, client) {
        await interaction.deferReply();

        await interaction.editReply({
            content: '🎰 **Soul Slots are spinning...**',
        });

        await new Promise(resolve => setTimeout(resolve, 1100));

        const slots = spinSlots();
        const played = await playGame(
            client,
            interaction,
            'soulslots',
            { slots }
        );

        if (!played.ok) {
            return interaction.editReply({ content: played.message });
        }

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(text.title)
            .setDescription(
                `🎰 **${slots.join('  |  ')}**\n\n` +
                text.description
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ content: '', embeds: [embed] });
    },
};
