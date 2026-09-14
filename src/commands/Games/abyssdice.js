import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { playGame, resultText, balanceFooter } from './modules/gameEngine.js';

export default {
    data: new SlashCommandBuilder()
        .setName('abyssdice')
        .setDescription('Roll the Abyss Dice for Souls or a rare Shard.'),

    async execute(interaction, config, client) {
        await interaction.deferReply();

        const roll = Math.floor(Math.random() * 6) + 1;
        const won = roll >= 4;

        await interaction.editReply({
            content: '🎲 **The Abyss Dice are rolling...**',
        });

        await new Promise(resolve => setTimeout(resolve, 900));

        const played = await playGame(
            client,
            interaction,
            'abyssdice',
            {
                roll,
                forceLoss: !won,
            }
        );

        if (!played.ok) {
            return interaction.editReply({ content: played.message });
        }

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(won ? '🎲 YOU WIN!' : '💔 BETTER LUCK NEXT TIME')
            .setDescription(
                `🎲 The Abyss Dice rolled **${roll}**.\n\n` +
                text.description
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ content: '', embeds: [embed] });
    },
};
