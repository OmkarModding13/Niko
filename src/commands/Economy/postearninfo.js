import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EARN_CHANNEL_ID = '1548932541283835904';
const CHARACTERS_ABILITY_CHANNEL_ID = '1550118678396149910';
const GAME_SHOP_CHANNEL_ID = '1547531709959118911';
const NIKO_NOTIFICATIONS_CHANNEL_ID = '1550119194811572244';
const INVENTORY_CHANNEL_ID = '1550120893982703616';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const EMBED_BLUE = 0x168BFF;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BANNER_PATH = path.join(__dirname, '../../assets/HowToEarn.png');

function buildEarnInfoEmbed() {
    return new EmbedBuilder()
        .setColor(EMBED_BLUE)
        .setTitle(`${TOTAL_SOULS_EMOJI} HOW TO EARN SOULS & SHARDS`)
        .setDescription(
            '**Welcome to Hollow Devil\'s Domain.**\n' +
            'Stay active, play games and build your wealth. Souls are the main currency, while Shards are the rare currency of the Domain.\n\n' +

            '**🎁 DAILY REWARD**\n' +
            'Use **/daily** once every 24 hours.\n' +
            `> ${SOULS_EMOJI} Base reward: **25 Souls**\n` +
            '> 🔥 Consecutive claim streaks can give additional bonus Souls.\n\n' +

            '**💬 CHAT ACTIVITY**\n' +
            `> ${SOULS_EMOJI} Earn **2 Souls every 10 minutes** of eligible chat activity.\n` +
            '> ⚠️ Spamming or flooding messages does not increase your rewards.\n\n' +

            '**🎙️ VOICE ACTIVITY**\n' +
            `> ${SOULS_EMOJI} Earn **1 Soul every 15 minutes** of eligible Voice activity.\n` +
            '> 👥 At least **2 members** must be in the Voice Channel.\n' +
            '> 🔇 Self-muted activity does not count.\n' +
            '> 🙉 Self-deafened activity does not count.\n\n' +

            '**🎮 GAMES**\n' +
            `Play Niko\'s games from <#${GAME_SHOP_CHANNEL_ID}>. Games use Souls as the entry fee.\n` +
            `> ${SOULS_EMOJI} **Common reward** → Souls\n` +
            '> ❌ **Better Luck Next Time** → No reward\n' +
            `> 💰 **Double Souls** → 2× Souls reward\n` +
            `> ${SHARD_EMOJI} **Rare reward** → Shard\n` +
            `> ${SHARD_EMOJI} Shards are intentionally **very rare**.\n\n` +

            '**💎 SHARDS — RARE CURRENCY**\n' +
            `> ${SHARD_EMOJI} **1 Shard = 10,000 Souls worth of value**\n` +
            `> ${SHARD_EMOJI} Shards are mainly obtained through rare game rewards.\n` +
            '> ⚠️ Shards are not meant to be a common currency.\n' +
            '> ✨ Save them for rare upgrades and special perks.\n\n' +

            '**📚 SOULS ECONOMY CHANNELS**\n' +
            `> ☠️ <#${EARN_CHANNEL_ID}> → Learn how to earn Souls and Shards.\n` +
            `> ☠️ <#${CHARACTERS_ABILITY_CHANNEL_ID}> → View Gacha Characters, rarities, abilities and character information.\n` +
            `> ☠️ <#${GAME_SHOP_CHANNEL_ID}> → Play Niko\'s games and use the Shop to spend Souls and Shards.\n` +
            `> ☠️ <#${NIKO_NOTIFICATIONS_CHANNEL_ID}> → Receive important Niko notifications when DMs cannot be delivered.\n` +
            `> ☠️ <#${INVENTORY_CHANNEL_ID}> → View your Characters, Shards, boosts, tickets and other items.\n\n` +

            '**📈 KEEP EARNING**\n' +
            `> ${TOTAL_SOULS_EMOJI} Check your balance with **/balance**.\n` +
            '> 🎁 Claim **/daily** every 24 hours.\n' +
            '> 🎮 Play games and take your chance at rare rewards.\n' +
            '> 💬 Stay active in chat and Voice Channels.\n\n' +

            `🩸 **Stay Active. Earn Souls. Find Shards.** ${SHARD_EMOJI}`
        )
        .setFooter({ text: 'Hollow Devil’s Domain • Souls & Shards Guide' });
}

export default {
    data: new SlashCommandBuilder()
        .setName('postearninfo')
        .setDescription('Post the How to Earn Souls and Shards guide')
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
