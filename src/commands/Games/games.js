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
                `Enter games using ${SOULS_EMOJI} **Souls**. Some games can also award ${SHARD_EMOJI} **Shards**.\n\n` +
                `**${TOTAL_SOULS_EMOJI} ENTRY FEES**\n` +
                `Every solo game has its own entry fee. The fee is deducted when you play.\n` +
                `${SHARD_EMOJI} **Every winning game has a 1% base chance to drop 1 Shard.** Character luck can increase this chance.\n\n` +
                '**🌱 SOLO GAMES**'
            )
            .addFields(
                {
                    name: `${SOULS_EMOJI} /quickcoin — 20 Souls`,
                    value: `${SOULS_EMOJI} Heads vs ${TAILS_EMOJI} Tails • Win up to **100 Souls**.`,
                    inline: false
                },
                {
                    name: '🎲 /abyssdice — 30 Souls',
                    value: 'Roll the Abyss Dice • Win up to **100 Souls**.',
                    inline: false
                },
                {
                    name: '✊ /rps — 30 Souls',
                    value: 'Rock, Paper, Scissors against Niko • Win up to **100 Souls**. Draw = refund.',
                    inline: false
                },
                {
                    name: '⚔️ /soulflip — 50 Souls',
                    value: `${SOULS_EMOJI} Heads vs ${TAILS_EMOJI} Tails • Win up to **150 Souls**.`,
                    inline: false
                },
                {
                    name: '🎲 /diceduel — 100 Souls',
                    value: 'Roll against Niko • Win up to **300 Souls**.',
                    inline: false
                },
                {
                    name: '🎰 /soulslots — 150 Souls',
                    value: 'Spin the Soul Slots • Win up to **450 Souls**.',
                    inline: false
                },
                {
                    name: '\u200b',
                    value: '**⚔️ PVP MATCHES — 2/3/4 PLAYER**',
                    inline: false
                },
                {
                    name: '✊ /pvp — Rock Paper Scissors',
                    value: `**2 or 3 players** • ${SOULS_EMOJI} **300 Souls each** • Winner takes the pot (**600 / 900 Souls**). Join/Reject happens directly in the channel.`,
                    inline: false
                },
                {
                    name: `${SOULS_EMOJI} /pvp — Heads & Tails`,
                    value: `**2 players** • ${SOULS_EMOJI} **900 Souls each** • Winner takes **1,800 Souls**.`,
                    inline: false
                },
                {
                    name: '🎯 /pvp — Number Guess',
                    value: `**4 players** • Each player chooses their own ${SOULS_EMOJI} bet • Guess **1–4** • Winner takes the full pot.`,
                    inline: false
                },
                {
                    name: '\u200b',
                    value: '**🏦 MULTIPLAYER**',
                    inline: false
                },
                {
                    name: '🚨 /bankrob — Bank Robbery',
                    value: `**2–10 players** • **40% success / 60% police catch** • Up to **80%** of the target wallet can be stolen. Join/Reject happens directly in the command channel.`,
                    inline: false
                },
                {
                    name: '\u200b',
                    value: '**🎰 CHARACTER GACHA**',
                    inline: false
                },
                {
                    name: `${SHARD_EMOJI} /gacha — 1 Spin`,
                    value: 'Cost: **1 Shard** • Common → Mystic rewards.',
                    inline: false
                },
                {
                    name: `${SHARD_EMOJI} /gacha — 10 Spins`,
                    value: 'Cost: **10 Shards** • 10 reward rolls in one summon.',
                    inline: false
                },
                {
                    name: `${SOULS_EMOJI} POSSIBLE SOLO REWARDS`,
                    value: 'Common Souls • Double Souls • Extra Souls • 1 Shard • Better Luck Next Time',
                    inline: false
                },
                {
                    name: '🎰 GACHA RARITIES',
                    value: 'Common → Souls / Double Souls\nRare → XP Booster / Bank Protection\nEpic → Bank Capacity / 1 Shard\nLegendary → 4★ Character\nMystic → 5★ Character\n🔁 Duplicate Character → 2 Shards',
                    inline: false
                }
            )
            .setFooter({ text: `${TOTAL_SOULS_EMOJI} Build Souls • Collect Shards • Complete Your Character Collection` });

        return interaction.reply({ embeds: [embed] });
    }
};