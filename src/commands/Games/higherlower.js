import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GAME_CONFIG, playGame, resultText, balanceFooter } from './modules/gameEngine.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const config = GAME_CONFIG.higherlower;

export default {
    data: new SlashCommandBuilder()
        .setName('higherlower')
        .setDescription('Guess whether the next number will be higher or lower.'),

    async execute(interaction, configArg, client) {
        await interaction.deferReply();
        const current = Math.floor(Math.random() * 10) + 1;
        const next = Math.floor(Math.random() * 10) + 1;

        const buttons = ['higher', 'lower'];
        const choice = buttons[Math.floor(Math.random() * buttons.length)];
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
                `⬆️⬇️ Your guess: **${choice.toUpperCase()}**\n` +
                `🎯 Next number: **${next}**\n\n${text.description}`
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ embeds: [embed] });
    },
};
