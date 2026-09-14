import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import {
    GAME_CONFIG,
    playGame,
    resultText,
    balanceFooter,
} from './modules/gameEngine.js';

const config = GAME_CONFIG.soulflip;

export default {
    data: new SlashCommandBuilder()
        .setName('soulflip')
        .setDescription('Flip the Soul Coin for a chance to win Souls or a rare Shard.')
        .addStringOption(option =>
            option
                .setName('choice')
                .setDescription('Choose Heads or Tails')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' },
                )
        ),

    async execute(interaction, configArg, client) {
        await interaction.deferReply();

        const choice = interaction.options.getString('choice');
        const flip = Math.random() < 0.5 ? 'heads' : 'tails';

        await interaction.editReply({
            content: '🪙 **The Soul Coin is flipping...**',
        });

        await new Promise(resolve => setTimeout(resolve, 900));

        const wonFlip = choice === flip;
        const played = await playGame(
            client,
            interaction,
            'soulflip',
            {
                flip,
                choice,
                forcedLoss: !wonFlip,
            }
        );

        if (!played.ok) {
            return interaction.editReply({ content: played.message });
        }

        if (!wonFlip) {
            played.result.type = 'loss';
            played.result.souls = 0;
            played.result.shards = 0;
        }

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(text.title)
            .setDescription(
                `🪙 You chose **${choice}**\n` +
                `🎯 The coin landed on **${flip}**.\n\n` +
                text.description
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ content: '', embeds: [embed] });
    },
};
