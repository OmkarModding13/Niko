import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GAME_CONFIG, playGame, resultText, balanceFooter } from './modules/gameEngine.js';

export default {
    data: new SlashCommandBuilder()
        .setName('numberguess')
        .setDescription('Guess the secret number from 1 to 10.')
        .addIntegerOption(option =>
            option
                .setName('number')
                .setDescription('Pick a number from 1 to 10')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)
        ),

    async execute(interaction, configArg, client) {
        await interaction.deferReply();
        const guess = interaction.options.getInteger('number');
        const secret = Math.floor(Math.random() * 10) + 1;
        const won = guess === secret;

        const played = await playGame(client, interaction, 'numberguess', {
            guess,
            secret,
            forceLoss: !won,
        });

        if (!played.ok) return interaction.editReply({ content: played.message });

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(won ? '🎯 PERFECT GUESS!' : text.title)
            .setDescription(
                `🔢 Your guess: **${guess}**\n` +
                `🔮 Secret number: **${secret}**\n\n` +
                (won ? `You found the secret number!\n${text.description}` : text.description)
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ embeds: [embed] });
    },
};
