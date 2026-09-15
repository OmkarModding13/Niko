import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EARN_CHANNEL_ID = '1548932541283835904';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const EMBED_BLUE = 0x168BFF;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BANNER_PATH = path.join(__dirname, '../../assets/HowToEarn.png');

function buildEarnInfoEmbed() {
    return new EmbedBuilder()
        .setColor(EMBED_BLUE)
        .setTitle(`${TOTAL_SOULS_EMOJI} HOW TO EARN & USE SOULS`)
        .setDescription(
            '**Welcome to Hollow Devil\'s Domain.**\n' +
            'Earn Souls, collect rare Shards, unlock characters and use your rewards wisely.\n\n' +

            '**🎁 DAILY REWARD**\n' +
            'Use **/daily** once every 24 hours. Base reward: **25 Souls**.\n' +
            '> 🔥 Consecutive claim streaks give additional bonus Souls.\n' +
            '> ✨ Character passives can increase your daily reward.\n\n' +

            '**💬 CHAT REWARDS**\n' +
            `> ${SOULS_EMOJI} Earn **2 Souls every 10 minutes** of eligible chat activity.\n` +
            '> ⚠️ Spam and message flooding will not help you earn more.\n\n' +

            '**🎙️ VOICE REWARDS**\n' +
            `> ${SOULS_EMOJI} Earn **1 Soul every 15 minutes** of eligible Voice activity.\n` +
            '> 👥 At least **2 members** must be in the VC.\n' +
            '> 🔇 Self-muted activity does not count.\n' +
            '> 🙉 Self-deafened activity does not count.\n\n' +

            '**🎮 GAMES**\n' +
            'Use **/games** to open the Games menu.\n' +
            `> ${SOULS_EMOJI} **Solo:** /quickcoin • /abyssdice • /rps • /soulflip • /diceduel • /soulslots\n` +
            '> ⚔️ **PvP:** /pvp — RPS, Heads & Tails, Number Guess\n' +
            '> 🏦 **Multiplayer:** /bankrob — 2–10 players\n' +
            `> ${SHARD_EMOJI} Eligible wins/successes have a **1% base chance** to drop 1 Shard.\n` +
            `> ${SOULS_EMOJI} Game rewards depend on the game and its entry fee.\n\n` +

            '**🎰 CHARACTER GACHA**\n' +
            `Use **/gacha** by spending ${SHARD_EMOJI} **1 Shard for 1 Spin** or **10 Shards for 10 Spins**.\n` +
            '**Gacha Rates per Spin:**\n' +
            '> 🟢 Common — **75%**\n' +
            '> 🔵 Rare — **17%**\n' +
            '> 🟣 Epic — **6%**\n' +
            '> ⭐ Legendary — **1.8%** → 4★ Character\n' +
            '> ✨ Mystic — **0.2%** → 5★ Character\n' +
            '> 💫 Total character chance — **2% per spin**\n' +
            '> 🔁 Duplicate Character → **2 Shards**\n\n' +

            '**✨ CHARACTER PASSIVES**\n' +
            '> **Lumira** → +5 Souls to Daily reward\n' +
            '> **Niko** → +10 Souls to Daily reward\n' +
            '> **Seraphne** → +0.5% Game Shard chance\n' +
            '> **Eiris** → +1 Gacha luck percentage point\n' +
            '> **Carmine** → +1% Game Shard chance\n' +
            '> **Valeris** → +4 hours Bank Protection duration\n\n' +

            '**🛒 SHOP**\n' +
            'Use **/shop** to spend Souls.\n' +
            '> 🎨 Color Roles — **350 Souls / 7 days**\n' +
            '> 🏦 Bank Capacity Upgrade — **3,000 Souls** first upgrade\n' +
            '> ⚡ XP Booster — **3,000 Souls / 24 hours**\n' +
            '> 🛡️ Bank Protection — **3,000 Souls / 24 hours**\n\n' +

            '**📋 USEFUL COMMANDS**\n' +
            `> ${TOTAL_SOULS_EMOJI} **/balance** — Check Souls, Bank and Shards\n` +
            '> 🎁 **/daily** — Claim your daily Souls\n' +
            '> 🎰 **/gacha** — Spend Shards for rewards and characters\n' +
            '> ✨ **/flex** — Show your character collection\n' +
            '> 🎮 **/games** — Open the Games menu\n' +
            '> 🛒 **/shop** — Open the Shop\n' +
            '> ⏰ **/remindme** — Set a daily reminder\n\n' +

            `🩸 **Stay Active. Earn Souls. Collect Shards. Build Your Collection.** ${TOTAL_SOULS_EMOJI}`
        )
        .setFooter({ text: 'Hollow Devil’s Domain • Economy, Games & Gacha Guide' });
}

export default {
    data: new SlashCommandBuilder()
        .setName('postearninfo')
        .setDescription('Post the How to Earn Souls guide')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    category: 'Economy',

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need the **Manage Server** permission to use this command.',
                ephemeral: true,
            });
        }

        const channel = await interaction.guild.channels.fetch(EARN_CHANNEL_ID).catch(() => null);

        if (!channel?.isTextBased()) {
            return interaction.reply({
                content: '❌ The configured How to Earn channel could not be found.',
                ephemeral: true,
            });
        }

        const banner = new AttachmentBuilder(BANNER_PATH, { name: 'HowToEarn.png' });
        const embed = buildEarnInfoEmbed();

        await channel.send({ files: [banner] });
        await channel.send({ embeds: [embed] });

        return interaction.reply({
            content: `✅ How to Earn guide posted in <#${EARN_CHANNEL_ID}>.`,
            ephemeral: true,
        });
    },
};
