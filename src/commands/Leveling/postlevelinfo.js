import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVEL_INFO_CHANNEL_ID = '1530876981304885299';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const EMBED_BLUE = 0x168BFF;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BANNER_PATH = path.join(__dirname, '../../assets/HowToLevelUp.png');

function buildLevelInfoEmbed() {
    return new EmbedBuilder()
        .setColor(EMBED_BLUE)
        .setTitle('⚡ HOW TO LEVEL UP')
        .setDescription(
            '**Want to level up in Hollow Devil\'s Domain?**\n' +
            'Stay active, earn XP, and keep progressing.\n\n' +
            '**💬 CHAT ACTIVITY**\n' +
            'Chat with the community to earn XP through active conversation.\n' +
            '> ⚠️ Spam and message flooding will not help you level up.\n' +
            '> ⏱️ Chat XP is earned through active chat time.\n\n' +
            '**🎙️ VOICE ACTIVITY**\n' +
            'Spend time in Voice Channels with other members to earn XP.\n' +
            '> 👥 At least **2 members** must be in the VC.\n' +
            '> 🔇 Self-muted activity does not count.\n' +
            '> 🙉 Self-deafened activity does not count.\n\n' +
            '**🎮 GAME ACTIVITY**\n' +
            'Play Niko\'s games to earn **XP + Souls**.\n' +
            '> 🎯 Different games have different entry fees and rewards.\n' +
            '> ✨ Winning games can also give you a chance to receive **Shards**.\n\n' +
            '**📈 XP SYSTEM**\n' +
            '> **100 XP = 1 Level**\n' +
            '> XP carries toward your next level.\n' +
            '> Your level does **not automatically decrease**.\n\n' +
            '**🗓️ LEVEL PROGRESSION**\n' +
            '> 🟢 **Level 1–49** → Weekly Activity System\n' +
            '> 🔴 **Level 50+** → Monthly Activity System\n\n' +
            '**📅 ACTIVITY REQUIREMENTS**\n' +
            '**Levels 1–49 — Weekly:**\n' +
            '> 🎙️ Voice: **21 hours/week**\n' +
            '> 💬 Chat: **35 hours/week**\n' +
            '> 🎮 Games: **15 games/week**\n' +
            '> ✅ All three activities must be completed for a successful period.\n\n' +
            '**Levels 50+ — Monthly:**\n' +
            '> Your progression switches from weekly to monthly activity.\n' +
            '> 📅 The monthly period is used to progress through Level 50+.\n\n' +
            '**⚠️ FAILED ACTIVITY PERIOD**\n' +
            '> 1st consecutive failed period → Current XP is **halved**.\n' +
            '> 2nd consecutive failed period → Current XP becomes **0**.\n' +
            '> 🔒 Your Level itself will **never decrease**.\n\n' +
            '**⚡ XP BOOSTER**\n' +
            '> 🛒 XP Booster gives **2× XP for 24 hours**.\n' +
            '> It can be obtained through the Shop or Gacha.\n\n' +
            `🩸 **KEEP ACTIVE. EARN XP. RISE THROUGH THE DOMAIN.** ${SOULS_EMOJI} ${SHARD_EMOJI}`,
        )
        .setFooter({ text: 'Hollow Devil’s Domain • Leveling Guide' });
}

export default {
    data: new SlashCommandBuilder()
        .setName('postlevelinfo')
        .setDescription('Post the How to Level Up guide')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    category: 'Leveling',

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need the **Manage Server** permission to use this command.',
                ephemeral: true,
            });
        }

        const channel = await interaction.guild.channels.fetch(LEVEL_INFO_CHANNEL_ID).catch(() => null);

        if (!channel?.isTextBased()) {
            return interaction.reply({
                content: '❌ The configured How to Level Up channel could not be found.',
                ephemeral: true,
            });
        }

        const banner = new AttachmentBuilder(BANNER_PATH, { name: 'HowToLevelUp.png' });
        const embed = buildLevelInfoEmbed();

        await channel.send({ files: [banner] });
        await channel.send({ embeds: [embed] });

        return interaction.reply({
            content: `✅ How to Level Up guide posted in <#${LEVEL_INFO_CHANNEL_ID}>.`,
            ephemeral: true,
        });
    },
};