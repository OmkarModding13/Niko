import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import {
    GAME_CONFIG,
    playGame,
    resultText,
    balanceFooter,
} from './modules/gameEngine.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TAILS_EMOJI = '<:Tails:1549019689022132315>';
const config = GAME_CONFIG.soulflip;

export default {
    data: new SlashCommandBuilder()
        .setName('soulflip')
        .setDescription('Flip the Soul Coin for a chance to win Souls or a rare Shard.')
        .addStringOption(option =>
            option
                .setName('choice')
                .setDescription('Choose Heads or Tails')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads — Souls', value: 'heads' },
                    { name: 'Tails', value: 'tails' },
                )
        ),

    async execute(interaction, configArg, client) {
        await interaction.deferReply();

        const choice = interaction.options.getString('choice');
        const flip = Math.random() < 0.5 ? 'heads' : 'tails';

        await interaction.editReply({
            content: `${SOULS_EMOJI} **The Soul Coin is flipping...**`,
        });

        await new Promise(resolve => setTimeout(resolve, 900));

        const wonFlip = choice === flip;
        const played = await playGame(
            client,
            interaction,
            'soulflip',
            {
                flip,
                choice,
                forceLoss: !wonFlip,
            }
        );

        if (!played.ok) {
            return interaction.editReply({ content: played.message });
        }

        const text = resultText(played.result);
        const choiceEmoji = choice === 'heads' ? SOULS_EMOJI : TAILS_EMOJI;
        const flipEmoji = flip === 'heads' ? SOULS_EMOJI : TAILS_EMOJI;

        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(text.title)
            .setDescription(
                `${choiceEmoji} You chose **${choice === 'heads' ? 'Heads' : 'Tails'}**\n` +
                `${flipEmoji} The coin landed on **${flip === 'heads' ? 'Heads' : 'Tails'}**.\n\n` +
                text.description
            )
            .setFooter({ text: balanceFooter(played.result) });

        return interaction.editReply({ content: '', embeds: [embed] });
    },
};
