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
                `**${TOTAL_SOULS_EMOJI} HOW GAME FEES WORK**\n` +
                `**ENTRY** = Souls removed when you start the game.\n` +
                `**WIN** = maximum Souls payout you can receive. The entry fee is separate.\n` +
                `${SHARD_EMOJI} **Every winning game has a 1% base chance to drop 1 Shard.** Character luck can increase this chance.\n\n` +
                '**🌱 SOLO GAMES**'
            )
            .addFields(
                {
                    name: `🪙 /quickcoin`,
                    value: `**Entry:** ${SOULS_EMOJI} **20 Souls**\n${SOULS_EMOJI} Heads vs ${TAILS_EMOJI} Tails • **Win up to 100 Souls**.`,
                    inline: false
                },
                {
                    name: '🎲 /abyssdice',
                    value: `**Entry:** ${SOULS_EMOJI} **30 Souls**\nRoll the Abyss Dice • **Win up to 100 Souls**.`,
                    inline: false
                },
                {
                    name: '✊ /rps',
                    value: `**Entry:** ${SOULS_EMOJI} **30 Souls**\nRock, Paper, Scissors against Niko • **Win up to 100 Souls**. Draw = refund.`,
                    inline: false
                },
                {
                    name: '⚔️ /soulflip',
                    value: `**Entry:** ${SOULS_EMOJI} **50 Souls**\n${SOULS_EMOJI} Heads vs ${TAILS_EMOJI} Tails • **Win up to 150 Souls**.`,
                    inline: false
                },
                {
                    name: '🎲 /diceduel',
                    value: `**Entry:** ${SOULS_EMOJI} **100 Souls**\nRoll against Niko • **Win up to 300 Souls**.`,
                    inline: false
                },
                {
                    name: '🎰 /soulslots',
                    value: `**Entry:** ${SOULS_EMOJI} **150 Souls**\nSpin the Soul Slots • **Win up to 450 Souls**.`,
                    inline: false
                },
                {
                    name: `💠 /shardgamble`,
                    value: `**Entry:** ${SOULS_EMOJI} **1,000 Souls per spin**\nRisk Souls for a **1% Shard chance** • Win **1–10 Shards**. 10 Spins = **10,000 Souls**.`,
                    inline: false
                },
                {
                    name: '\u200b',
                    value: '**⚔️ PVP MATCHES — 2/3/4 PLAYER**',
                    inline: false
                },
                {
                    name: '✊ /pvp — Rock Paper Scissors',
                    value: `**Entry:** ${SOULS_EMOJI} **300 Souls per player**\n**2 or 3 players** • Winner takes the full pot (**600 / 900 Souls**). Join/Reject happens directly in the channel.`,
                    inline: false
                },
                {
                    name: `${SOULS_EMOJI} /pvp — Heads & Tails`,
                    value: `**Entry:** ${SOULS_EMOJI} **900 Souls per player**\n**2 players** • Winner takes the full **1,800 Souls** pot.`,
                    inline: false
                },
                {
                    name: '🎯 /pvp — Number Guess',
                    value: `**Entry:** Each player chooses their own ${SOULS_EMOJI} **bet (minimum 1 Soul)**\n**4 players** • Guess **1–4** • Correct guessers split the full pot.`,
                    inline: false
                },
                {
                    name: '\u200b',
                    value: '**🏦 MULTIPLAYER**',
                    inline: false
                },
                {
                    name: '🚨 /bankrob — Bank Robbery',
                    value: `**Entry:** No Souls fee\n**2–10 players** • **40% success / 60% police catch** • Success steals **exactly 80%** of the target's wallet, split across the crew. Failure = **1,000 Souls fine per robber + 10-minute cooldown**.`,
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
                    name: `${SHARD_EMOJI} SOLO REWARD TYPES`,
                    value: 'Common → Souls payout • Double → 2× entry payout • Extra → 3× entry payout • Rare → 1 Shard • Loss → no payout',
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