import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVEL_INFO_CHANNEL_ID = '1530876981304885299';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BANNER_PATH = path.join(__dirname, '../../assets/HowToLevelUp.png');

function buildLevelInfoEmbed() {
    return new EmbedBuilder()
        .setTitle('⚡ HOW TO LEVEL UP')
        .setDescription(
            '**Want to level up in Hollow Devil\'s Domain?**\n' +
            'Stay active, earn XP, and keep progressing.\n\n' +
            '**💬 Chat Activity**\n' +
            'Talk with the community and earn XP through active chatting.\n' +
            '> ⚠️ Spam and message flooding will not help you level up.\n\n' +
            '**🎙️ Voice Activity**\n' +
            'Spend time hanging out with other members in Voice Channels to earn XP.\n' +
            '> 👥 At least **2 members** must be in the VC.\n' +
            '> 🔇 Self-muted activity does not count.\n' +
            '> 🙉 Self-deafened activity does not count.\n\n' +
            '**🎮 Game Activity**\n' +
            'Play Niko\'s games to earn **XP + Souls**.\n\n' +
            '**📈 XP SYSTEM**\n' +
            `> **100 XP = 1 Level**\n` +
            '> Your level does not automatically decrease.\n\n' +
            '**🗓️ ACTIVITY PROGRESSION**\n' +
            '> 🟢 **Level 1–49** → Weekly Activity\n' +
            '> 🔴 **Level 50+** → Monthly Activity\n\n' +
            '**⚠️ XP FARMING**\n' +
            'Cooldowns and activity checks prevent meaningless spam from being used to farm XP.\n\n' +
            `🩸 **Stay Active. Earn XP. Rise Through the Domain.** ${SOULS_EMOJI}`,
        )
        .setImage('attachment://HowToLevelUp.png')
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

        await channel.send({
            embeds: [embed],
            files: [banner],
        });

        return interaction.reply({
            content: `✅ How to Level Up guide posted in <#${LEVEL_INFO_CHANNEL_ID}>.`,
            ephemeral: true,
        });
    },
};
