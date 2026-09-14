import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { playGame, resultText, balanceFooter } from './modules/gameEngine.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';

export default {
    data: new SlashCommandBuilder()
        .setName('quickguess')
        .setDescription('Guess the secret number from 1 to 3 for 20 Souls.')
        .addIntegerOption(option => option
            .setName('number')
            .setDescription('Pick 1, 2, or 3')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(3)),

    async execute(interaction, config, client) {
        await interaction.deferReply();
        const guess = interaction.options.getInteger('number');
        const secret = Math.floor(Math.random() * 3) + 1;
        const won = guess === secret;
        const played = await playGame(client, interaction, 'quickguess', {
            guess,
            secret,
            forceLoss: !won,
        });
        if (!played.ok) return interaction.editReply({ content: played.message });

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(won ? '🎯 PERFECT GUESS!' : text.title)
            .setDescription(`🔢 Your guess: **${guess}**\n🔮 Secret number: **${secret}**\n\n${won ? `You found it!\n${text.description}` : text.description}`)
            .setFooter({ text: `${SOULS_EMOJI} Entry Fee: 20 Souls  •  ${balanceFooter(played.result)}` });

        return interaction.editReply({ embeds: [embed] });
    },
};
