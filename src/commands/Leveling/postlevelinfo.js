import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVEL_INFO_CHANNEL_ID = '1551159198425948180';
const EMBED_BLUE = 0x168BFF;

function buildLevelInfoEmbed() {
    return new EmbedBuilder()
        .setColor(EMBED_BLUE)
        .setTitle('📊 CHECK YOUR LEVEL')
        .setDescription(
            '**Want to know your current level and XP progress?**\n\n' +
            'Niko keeps track of your activity and XP as you participate in the Domain.\n\n' +
            '**🔎 HOW TO CHECK YOUR LEVEL**\n' +
            '> Use **/rank** in this channel.\n' +
            '> Niko will show your **current Level, current XP, Total XP, and progress toward your next Level**.\n\n' +
            '**📈 XP PROGRESS**\n' +
            '> Your current XP is shown like **75 / 100 XP**.\n' +
            '> The message also tells you exactly **how much XP you still need to reach the next Level**.\n' +
            '> **100 XP = 1 Level**.\n\n' +
            '**👤 CHECK SOMEONE ELSE**\n' +
            '> You can use **/rank** and select a **user** to view their Level and XP progress too.\n\n' +
            '**⚡ HOW TO EARN XP**\n' +
            '> 💬 Stay active in chat.\n' +
            '> 🎙️ Spend time in voice channels with other members.\n' +
            '> 🎮 Play Niko\'s games.\n\n' +
            '**💡 TIP**\n' +
            '> Keep being active in the Domain and watch your XP progress toward the next Level.\n\n' +
            '🩸 **CHECK YOUR LEVEL. TRACK YOUR XP. RISE THROUGH THE DOMAIN.**'
        )
        .setFooter({ text: 'Hollow Devil’s Domain • Level Check' });
}

export default {
    data: new SlashCommandBuilder()
        .setName('postlevelinfo')
        .setDescription('Post the Check Your Level guide')
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

        const embed = buildLevelInfoEmbed();

        await channel.send({ embeds: [embed] });

        return interaction.reply({
            content: `✅ Check Your Level guide posted in <#${LEVEL_INFO_CHANNEL_ID}>.`,
            ephemeral: true,
        });
    },
};