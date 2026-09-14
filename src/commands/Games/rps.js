import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { playGame, resultText, balanceFooter } from './modules/gameEngine.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const choices = ['rock', 'paper', 'scissors'];

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
            forceLoss: !won,
            guaranteedReward: tie,
        });
        if (!played.ok) return interaction.editReply({ content: played.message });

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(tie ? '🤝 DRAW!' : won ? '🏆 YOU WIN!' : '💔 YOU LOSE')
            .setDescription(`You: **${player.toUpperCase()}**\nNiko: **${niko.toUpperCase()}**\n\n${tie ? 'No one wins this round. Here is a small consolation payout.\n' : ''}${text.description}`)
            .setFooter({ text: `${SOULS_EMOJI} Entry Fee: 30 Souls  •  ${balanceFooter(played.result)}` });

        return interaction.editReply({ embeds: [embed] });
    },
};
