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
            'Build your Souls, collect Shards, unlock characters and use the Shop.\n\n' +

            '**🎁 DAILY REWARD**\n' +
            'Use **/daily** once every 24 hours. Base reward: **25 Souls**.\n' +
            '> 🔥 Streak bonuses increase your reward.\n' +
            '> ⭐ Character abilities can add extra Souls to your daily claim.\n\n' +

            '**💬 CHATTING**\n' +
            'Stay active and chat naturally to earn Souls and leveling XP over time.\n' +
            '> ⚠️ Spam and message flooding will not help you earn more.\n\n' +

            '**🎙️ VOICE CHAT**\n' +
            'Hang out with other members in Voice Channels to earn Souls and XP.\n' +
            '> 👥 At least **2 members** must be in the VC.\n' +
            '> 🔇 Self-muted and self-deafened activity does not count.\n\n' +

            '**🎮 GAMES**\n' +
            'Use **/games** to view all available games and entry fees.\n' +
            `> ${SOULS_EMOJI} **Solo:** /quickcoin • /abyssdice • /rps • /soulflip • /diceduel • /soulslots\n` +
            '> ⚔️ **PvP:** /pvp — Rock Paper Scissors, Heads & Tails, Number Guess\n' +
            '> 🏦 **Multiplayer:** /bankrob — 2–10 players\n' +
            `> ${SHARD_EMOJI} Winning games have a **1% base chance** to drop 1 Shard.\n` +
            `> ${DOUBLE_SOULS_EMOJI} Games can also award Souls and special reward rolls.\n\n` +

            '**🎰 CHARACTER GACHA**\n' +
            `Use **/gacha** with ${SHARD_EMOJI} **1 Shard** or **10 Shards**.\n` +
            '> Common → Souls / Double Souls\n' +
            '> Rare → XP Booster 24h / Bank Protection\n' +
            '> Epic → Bank Capacity Increase / 1 Shard\n' +
            '> Legendary → 4★ Character\n' +
            '> Mystic → 5★ Character\n' +
            '> 🔁 Duplicate character → **100 Souls**\n\n' +

            '**🛒 SHOP**\n' +
            'Use **/shop** to spend Souls.\n' +
            '> 🎨 Color Roles — 350 Souls / 7 days\n' +
            '> 🏦 Bank Capacity Upgrade — starts at 3,000 Souls\n' +
            '> ⚡ XP Booster — **3,000 Souls / 24 hours**\n' +
            '> 🛡️ Bank Protection — **3,000 Souls / 24 hours**\n\n' +

            '**📋 USEFUL COMMANDS**\n' +
            `> ${TOTAL_SOULS_EMOJI} **/balance** — Check Souls, Bank and Shards\n` +
            '> 🎁 **/daily** — Claim daily reward\n' +
            '> 🎰 **/gacha** — Spend Shards\n' +
            '> ✨ **/flex** — Show your character collection\n' +
            '> 🎮 **/games** — View games\n' +
            '> 🛒 **/shop** — Open the Shop\n' +
            '> ⏰ **/remindme** — Daily reminder\n\n' +

            `🩸 **Stay Active. Earn Souls. Collect Shards. Build Your Collection.** ${TOTAL_SOULS_EMOJI}`
        )
        .setFooter({ text: 'Hollow Devil’s Domain • Economy & Gacha Guide' });
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
