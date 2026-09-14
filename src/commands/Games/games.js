import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';

export default {
    data: new SlashCommandBuilder()
        .setName('games')
        .setDescription('View the games available in Hollow Devil’s Domain.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle('🎮 NIKO GAMES')
            .setDescription(
                'Enter a game with **Souls**, take your chance, and try to collect the rare **Shards**.\n\n' +
                `${SHARD_EMOJI} **1 Shard = 1,000 Souls worth**\n\n` +
                '**Available Games**'
            )
            .addFields(
                {
                    name: '🪙 /soulflip — 100 Souls',
                    value: 'Choose Heads or Tails and flip the Soul Coin.',
                    inline: false,
                },
                {
                    name: '🎲 /abyssdice — 250 Souls',
                    value: 'Roll the Abyss Dice and face your fate.',
                    inline: false,
                },
                {
                    name: '🎰 /soulslots — 500 Souls',
                    value: 'Spin the Soul Slots for a lucky payout.',
                    inline: false,
                },
                {
                    name: '🎁 Possible Results',
                    value:
                        `🪙 Common Souls\n💰 Double Souls\n${SHARD_EMOJI} **Rare Shard**\n💔 Better Luck Next Time`,
                    inline: false,
                },
            )
            .setFooter({ text: `${SOULS_EMOJI} Entry fees are paid from your wallet.` });

        return interaction.reply({ embeds: [embed] });
    },
};
