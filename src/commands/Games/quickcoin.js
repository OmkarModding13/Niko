import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { playGame, resultText, balanceFooter } from './modules/gameEngine.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TAILS_EMOJI = '<:Tails:1549019689022132315>';

export default {
    data: new SlashCommandBuilder()
        .setName('quickcoin')
        .setDescription('Flip a coin for a low 20 Souls entry fee.')
        .addStringOption(option => option
            .setName('choice')
            .setDescription('Choose Heads or Tails')
            .setRequired(true)
            .addChoices(
                { name: 'Heads — Souls', value: 'heads' },
                { name: 'Tails', value: 'tails' },
            )),

    async execute(interaction, config, client) {
        await interaction.deferReply();
        const choice = interaction.options.getString('choice');
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = choice === result;

        const played = await playGame(client, interaction, 'quickcoin', {
            choice,
            result,
            forceLoss: !won,
        });
        if (!played.ok) return interaction.editReply({ content: played.message });

        const text = resultText(played.result);
        const choiceEmoji = choice === 'heads' ? SOULS_EMOJI : TAILS_EMOJI;
        const resultEmoji = result === 'heads' ? SOULS_EMOJI : TAILS_EMOJI;
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(text.title)
            .setDescription(`${choiceEmoji} You chose **${choice === 'heads' ? 'Heads' : 'Tails'}**\n${resultEmoji} It landed on **${result === 'heads' ? 'Heads' : 'Tails'}**.\n\n${text.description}`)
            .setFooter({ text: `${SOULS_EMOJI} Entry Fee: 20 Souls  •  ${balanceFooter(played.result)}` });

        return interaction.editReply({ embeds: [embed] });
    },
};
