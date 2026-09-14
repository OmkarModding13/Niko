import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
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
                    name: `${SOULS_EMOJI} /soulflip — 100 Souls`,
                    value: 'Choose Heads or Tails and flip the Soul Coin.',
                    inline: false,
                },
                {
                    name: `🎲 /abyssdice — 250 Souls`,
                    value: 'Roll the Abyss Dice and face your fate.',
                    inline: false,
                },
                {
                    name: `🎰 /soulslots — 500 Souls`,
                    value: 'Spin the Soul Slots for a lucky payout.',
                    inline: false,
                },
                {
                    name: '🎁 Possible Results',
                    value:
                        `${SOULS_EMOJI} Common Souls\n${DOUBLE_SOULS_EMOJI} Double Souls\n${SHARD_EMOJI} **Rare Shard**\n💔 Better Luck Next Time`,
                    inline: false,
                },
            )
            .setFooter({ text: `${TOTAL_SOULS_EMOJI} Souls: Your wallet balance is used for entry fees.` });

        return interaction.reply({ embeds: [embed] });
    },
};
