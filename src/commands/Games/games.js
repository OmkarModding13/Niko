import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const TAILS_EMOJI = '<:Tails:1549019689022132315>';

export default {
    data: new SlashCommandBuilder()
        .setName('games')
        .setDescription('View the games available in Hollow Devil’s Domain.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle('🎮 NIKO GAMES')
            .setDescription(
                `Enter a game using ${SOULS_EMOJI} **Souls**. Every game has its own Entry Fee and reward limit.\n\n` +
                `**${TOTAL_SOULS_EMOJI} HOW ENTRY FEES WORK**\n` +
                `Every game requires an **Entry Fee** paid in ${SOULS_EMOJI} **Souls**.\n` +
                `The fee is **deducted from your wallet when you play**. You must have enough Souls to enter.\n\n` +
                `${SHARD_EMOJI} **1 Shard = 1,000 Souls worth**\n\n` +
                '**🌱 LOW ENTRY FEE GAMES**\n' +
                'Perfect for new members. Low entry fees and smaller Soul payouts.'
            )
            .addFields(
                {
                    name: `${SOULS_EMOJI} /quickcoin — Entry Fee: 20 Souls`,
                    value: `${SOULS_EMOJI} Heads vs ${TAILS_EMOJI} Tails • Win up to **100 Souls**.`,
                    inline: false,
                },
                {
                    name: '🔴 /redblack — Entry Fee: 25 Souls',
                    value: 'Guess Red or Black • Win up to **100 Souls**.',
                    inline: false,
                },
                {
                    name: '🎲 /abyssdice — Entry Fee: 30 Souls',
                    value: 'Roll the Abyss Dice • Win up to **100 Souls**.',
                    inline: false,
                },
                {
                    name: '✊ /rps — Entry Fee: 30 Souls',
                    value: 'Rock, Paper, Scissors against Niko • Win up to **100 Souls**. Draw = entry fee refunded and immediate retry.',
                    inline: false,
                },
                {
                    name: '\u200b',
                    value: '**⚔️ STANDARD ENTRY FEE GAMES**',
                    inline: false,
                },
                {
                    name: `${SOULS_EMOJI} /soulflip — Entry Fee: 50 Souls`,
                    value: `${SOULS_EMOJI} Heads vs ${TAILS_EMOJI} Tails • Win up to **150 Souls**.`,
                    inline: false,
                },
                {
                    name: '⬆️⬇️ /higherlower — Entry Fee: 75 Souls',
                    value: 'Guess whether the next number is higher or lower • Win up to **225 Souls**.',
                    inline: false,
                },
                {
                    name: '🎲 /diceduel — Entry Fee: 100 Souls',
                    value: 'Roll against Niko • Win up to **300 Souls**.',
                    inline: false,
                },
                {
                    name: '🎰 /soulslots — Entry Fee: 150 Souls',
                    value: 'Spin the Soul Slots • Win up to **450 Souls**.',
                    inline: false,
                },
                {
                    name: '\u200b',
                    value: '**🎁 POSSIBLE REWARDS**',
                    inline: false,
                },
                {
                    name: `${SOULS_EMOJI} Common Souls`,
                    value: 'Normal win',
                    inline: true,
                },
                {
                    name: `${DOUBLE_SOULS_EMOJI} Double Souls`,
                    value: 'Rare',
                    inline: true,
                },
                {
                    name: `${SOULS_EMOJI} Extra Souls`,
                    value: 'Rare bonus',
                    inline: true,
                },
                {
                    name: `${SHARD_EMOJI} Ultra Rare Shard`,
                    value: 'Extremely rare',
                    inline: true,
                },
                {
                    name: '💔 Better Luck Next Time',
                    value: 'Loss',
                    inline: true,
                },
            )
            .setFooter({ text: `${TOTAL_SOULS_EMOJI} Your wallet balance determines whether you can enter.` });

        return interaction.reply({ embeds: [embed] });
    },
};
