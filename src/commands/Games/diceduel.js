import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GAME_CONFIG, playGame, resultText, balanceFooter } from './modules/gameEngine.js';

export default {
    data: new SlashCommandBuilder()
        .setName('diceduel')
        .setDescription('Duel Niko with a dice roll for Souls or a rare Shard.'),

    async execute(interaction, configArg, client) {
        await interaction.deferReply();
        const playerRoll = Math.floor(Math.random() * 6) + 1;
        const nikoRoll = Math.floor(Math.random() * 6) + 1;
        const forceLoss = playerRoll <= nikoRoll;

        const played = await playGame(client, interaction, 'diceduel', {
            playerRoll,
            nikoRoll,
            forceLoss,
        });

        if (!played.ok) return interaction.editReply({ content: played.message });

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(playerRoll > nikoRoll ? '⚔️ YOU WIN!' : '💔 YOU LOSE')
            .setDescription(
                `🎲 Your roll: **${playerRoll}**\n` +
                `👿 Niko's roll: **${nikoRoll}**\n\n` +
                text.description
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ embeds: [embed] });
    },
};
