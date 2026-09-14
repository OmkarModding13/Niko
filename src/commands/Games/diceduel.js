import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GAME_CONFIG, playGame, resultText, balanceFooter } from './modules/gameEngine.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';

export default {
    data: new SlashCommandBuilder()
        .setName('diceduel')
        .setDescription('Duel Niko with a dice roll for Souls or a rare Shard.'),

    async execute(interaction, configArg, client) {
        await interaction.deferReply();

        const playerRoll = Math.floor(Math.random() * 6) + 1;
        const nikoRoll = Math.floor(Math.random() * 6) + 1;
        const draw = playerRoll === nikoRoll;
        const playerWon = playerRoll > nikoRoll;

        const played = await playGame(client, interaction, 'diceduel', {
            playerRoll,
            nikoRoll,
            draw,
            forceLoss: !playerWon && !draw,
        });

        if (!played.ok) return interaction.editReply({ content: played.message });

        if (draw) {
            const embed = new EmbedBuilder()
                .setColor(0x168BFF)
                .setTitle('🤝 DRAW!')
                .setDescription(
                    `🎲 Your roll: **${playerRoll}**\n` +
                    `👿 Niko's roll: **${nikoRoll}**\n\n` +
                    `Nobody wins this round. Your **${played.result.entry} ${SOULS_EMOJI} Souls** entry fee has been refunded.\n` +
                    `You can play again immediately.`
                )
                .setFooter({ text: balanceFooter(played.result) });

            return interaction.editReply({ embeds: [embed] });
        }

        const text = resultText(played.result);
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(playerWon ? '⚔️ YOU WIN!' : '💔 BETTER LUCK NEXT TIME')
            .setDescription(
                `🎲 Your roll: **${playerRoll}**\n` +
                `👿 Niko's roll: **${nikoRoll}**\n\n` +
                text.description
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ embeds: [embed] });
    },
};
