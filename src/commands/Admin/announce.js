import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

const NIKO_NOTIFICATIONS_CHANNEL_ID = '1550119194811572244';

const ANNOUNCEMENT = [
    '**🏆 NEW — LEADERBOARD SYSTEM**',
    '',
    'You can now compete with other members and track your progress on the server!',
    '',
    '• 📊 Track your activity and progress',
    '• 🎮 Game activity contributes to leaderboard progress',
    '• 🏅 Compete for the top positions',
    '• 👑 The **Top 3 players** are displayed on the leaderboard',
    '',
    '**🔧 BUG FIXES & IMPROVEMENTS**',
    '',
    'We have also fixed and improved several systems based on recent testing:',
    '',
    '• Fixed multiple economy-related issues',
    '• Fixed leaderboard tracking issues',
    '• Fixed balance display formatting',
    '• Improved data saving reliability',
    '• Fixed several command and system issues',
    '• Improved overall bot stability and reliability',
    '',
    'Niko is continuously being improved to provide a smoother and more reliable experience for everyone.',
    '',
    '🎮 **Play** • 🏆 **Compete** • 💠 **Collect Souls** • 👑 **Reach the Top 3**',
    '',
    '— **Niko** 🤖',
].join('\n');

export default {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Post the latest Niko update announcement')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),

    category: 'Admin',

    async execute(interaction) {
        const isServerOwner = interaction.guild?.ownerId === interaction.user.id;
        const isAdministrator = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

        if (!isServerOwner && !isAdministrator) {
            return interaction.reply({
                content: '❌ You need **Administrator** permission to use this command.',
                ephemeral: true,
            });
        }

        const channel = await interaction.guild.channels
            .fetch(NIKO_NOTIFICATIONS_CHANNEL_ID)
            .catch(() => null);

        if (!channel?.isTextBased()) {
            return interaction.reply({
                content: '❌ The Niko notification channel could not be found.',
                ephemeral: true,
            });
        }

        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({
                content: '❌ I do not have permission to send messages in the Niko notification channel.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📢 Niko — New Update is Live!')
            .setDescription(ANNOUNCEMENT)
            .setTimestamp()
            .setFooter({ text: "Hollow Devil's Domain • Niko" });

        const message = await channel.send({ embeds: [embed] });

        return interaction.reply({
            content: '✅ Niko update announcement posted in <#' + NIKO_NOTIFICATIONS_CHANNEL_ID + '>.\n[Jump to announcement](' + message.url + ')',
            ephemeral: true,
        });
    },
};
