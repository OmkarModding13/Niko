import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const NIKO_NOTIFICATIONS_CHANNEL_ID = '1550119194811572244';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const SOUL_EMOJI = '<:Souls:1547510037621112894>';

const ANNOUNCEMENT = [
    'Hey @everyone! 👋',
    '',
    'Niko has received another round of **improvements, bug fixes, and stability updates** this month. 💙',
    '',
    '**🆕 NEW & IMPROVED**',
    '',
    '• ' + SOUL_EMOJI + ' **Souls Economy** — Improved balance handling and data saving to make your Souls progress more reliable.',
    '• **Economy Reliability** — Improved how multiple economy actions are processed to prevent conflicting balance changes.',
    '• **Rewards** — Improved reward handling and added protection against rewards being given incorrectly when a save fails.',
    '• **Leaderboards** — Improved progress tracking and data consistency.',
    '• ' + SHARD_EMOJI + ' **Shard System** — Improved reliability and persistence for Shards, Niko\'s rarest resource.',
    '• **Overall Stability** — Improved Niko\'s stability when handling commands, events, and economy activity.',
    '',
    '**🛠️ BUG FIXES**',
    '',
    '• Fixed multiple economy-related saving issues',
    '• Fixed balance updates that could conflict with each other',
    '• Fixed failed economy saves being treated as successful',
    '• Fixed several issues affecting persistent player data',
    '• Fixed various system reliability issues',
    '• Improved overall bot stability and consistency',
    '',
    '**💙 WHAT THIS MEANS**',
    '',
    'The main focus of this update was making Niko\'s economy **more reliable and consistent**.',
    '',
    'Your ' + SOUL_EMOJI + ' **Souls, ' + SHARD_EMOJI + ' Shards, rewards, and progress** should now be handled more safely, especially during rapid actions and system restarts.',
    '',
    'Niko will continue receiving new features, improvements, and bug fixes as the community grows.',
    '',
    '🎮 Play • Earn ' + SOUL_EMOJI + ' Souls • Collect ' + SHARD_EMOJI + ' Shards • 🏆 Reach the Top',
    '',
    '— Niko 💙',
].join('\n');

export default {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Post the latest Niko update announcement')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),

    category: 'Admin',

    async execute(interaction) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const isServerOwner = interaction.guild?.ownerId === interaction.user.id;
        const isAdministrator = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

        if (!isServerOwner && !isAdministrator) {
            return InteractionHelper.safeEditReply(interaction, {
                content: '❌ You need **Administrator** permission to use this command.',
                ephemeral: true,
            });
        }

        const channel = await interaction.guild.channels
            .fetch(NIKO_NOTIFICATIONS_CHANNEL_ID)
            .catch(() => null);

        if (!channel?.isTextBased()) {
            return InteractionHelper.safeEditReply({
                content: '❌ The Niko notification channel could not be found.',
                ephemeral: true,
            });
        }

        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return InteractionHelper.safeEditReply({
                content: '❌ I do not have permission to send messages in the Niko notification channel.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📢 Niko — Monthly Update is Live!')
            .setDescription(ANNOUNCEMENT)
            .setTimestamp()
            .setFooter({ text: "Hollow Devil's Domain • Niko" });

        const message = await channel.send({
            embeds: [embed],
            allowedMentions: {
                parse: [],
            },
        });

        return InteractionHelper.safeEditReply({
            content: '✅ Niko update announcement posted in <#' + NIKO_NOTIFICATIONS_CHANNEL_ID + '>.' + '\n[Jump to announcement](' + message.url + ')',
            ephemeral: true,
        });
    },
};
