import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { playGame, resultText, balanceFooter } from './modules/gameEngine.js';

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
        const uniqueSymbols = new Set(slots).size;
        const winningSpin = uniqueSymbols < 3;

        const played = await playGame(
            client,
            interaction,
            'soulslots',
            {
                slots,
                forceLoss: !winningSpin,
            }
        );

        if (!played.ok) {
            return interaction.editReply({ content: played.message });
        }

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(winningSpin ? text.title : '💔 BETTER LUCK NEXT TIME')
            .setDescription(
                `🎰 **${slots.join('  |  ')}**\n\n` +
                (winningSpin
                    ? text.description
                    : `No matching symbols. The Abyss took your **${played.result.entry} ${'<:Souls:1547510037621112894>'} Souls**.\nCome back and try again.`)
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ content: '', embeds: [embed] });
    },
};
