import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GAME_CONFIG, playGame, resultText, balanceFooter } from './modules/gameEngine.js';

const config = GAME_CONFIG.higherlower;

export default {
    data: new SlashCommandBuilder()
        .setName('higherlower')
        .setDescription('Guess whether the next number will be higher or lower.')
        .addStringOption(option =>
            option
                .setName('choice')
                .setDescription('Your prediction')
                .setRequired(true)
                .addChoices(
                    { name: 'Higher', value: 'higher' },
                    { name: 'Lower', value: 'lower' },
                )
        ),

    async execute(interaction, configArg, client) {
        await interaction.deferReply();
        const current = Math.floor(Math.random() * 10) + 1;
        const next = Math.floor(Math.random() * 10) + 1;
        const choice = interaction.options.getString('choice');
        const wonGuess = (choice === 'higher' && next > current) || (choice === 'lower' && next < current);

        const played = await playGame(client, interaction, 'higherlower', {
            current,
            next,
            choice,
            forceLoss: !wonGuess || next === current,
        });

        if (!played.ok) return interaction.editReply({ content: played.message });

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(text.title)
            .setDescription(
                `🔢 Current number: **${current}**\n` +
                `🎯 Your guess: **${choice.toUpperCase()}**\n` +
                `🔮 Next number: **${next}**\n\n${text.description}`
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ embeds: [embed] });
    },
};
