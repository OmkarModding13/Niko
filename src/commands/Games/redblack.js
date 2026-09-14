import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { playGame, resultText, balanceFooter } from './modules/gameEngine.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';

export default {
    data: new SlashCommandBuilder()
        .setName('redblack')
        .setDescription('Guess Red or Black for a 25 Souls entry fee.')
        .addStringOption(option => option
            .setName('choice')
            .setDescription('Choose Red or Black')
            .setRequired(true)
            .addChoices(
                { name: 'Red', value: 'red' },
                { name: 'Black', value: 'black' },
            )),

    async execute(interaction, config, client) {
        await interaction.deferReply();
        const choice = interaction.options.getString('choice');
        const result = Math.random() < 0.5 ? 'red' : 'black';
        const won = choice === result;

        const played = await playGame(client, interaction, 'redblack', {
            choice,
            result,
            forceLoss: !won,
        });
        if (!played.ok) return interaction.editReply({ content: played.message });

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(won ? '🎯 CORRECT!' : '💔 WRONG GUESS')
            .setDescription(`You chose **${choice.toUpperCase()}**\nThe result was **${result.toUpperCase()}**.\n\n${text.description}`)
            .setFooter({ text: `${SOULS_EMOJI} Entry Fee: 25 Souls  •  ${balanceFooter(played.result)}` });

        return interaction.editReply({ embeds: [embed] });
    },
};
