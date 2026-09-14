import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { playGame, resultText, balanceFooter, SOULS_EMOJI } from './modules/gameEngine.js';

const choices = ['rock', 'paper', 'scissors'];
const configEntry = 30;

export default {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock Paper Scissors for a low entry fee.')
        .addStringOption(option => option
            .setName('choice')
            .setDescription('Choose your move')
            .setRequired(true)
            .addChoices(
                { name: 'Rock', value: 'rock' },
                { name: 'Paper', value: 'paper' },
                { name: 'Scissors', value: 'scissors' },
            )),

    async execute(interaction, config, client) {
        await interaction.deferReply();
        const player = interaction.options.getString('choice');
        const niko = choices[Math.floor(Math.random() * choices.length)];
        const won = (player === 'rock' && niko === 'scissors') ||
            (player === 'paper' && niko === 'rock') ||
            (player === 'scissors' && niko === 'paper');
        const tie = player === niko;

        const played = await playGame(client, interaction, 'rps', {
            player,
            niko,
            forceLoss: !won && !tie,
            draw: tie,
        });
        if (!played.ok) return interaction.editReply({ content: played.message });

        if (tie) {
            const embed = new EmbedBuilder()
                .setColor(0x168BFF)
                .setTitle('🤝 DRAW!')
                .setDescription(
                    `You: **${player.toUpperCase()}**\n` +
                    `Niko: **${niko.toUpperCase()}**\n\n` +
                    `No one wins. Your **${configEntry} ${SOULS_EMOJI}** Entry Fee has been refunded.\n` +
                    'You can play again immediately.'
                )
                .setFooter({ text: balanceFooter(played.result) });
            return interaction.editReply({ embeds: [embed] });
        }

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(won ? '🏆 YOU WIN!' : '💔 YOU LOSE')
            .setDescription(`You: **${player.toUpperCase()}**\nNiko: **${niko.toUpperCase()}**\n\n${text.description}`)
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ embeds: [embed] });
    },
};
