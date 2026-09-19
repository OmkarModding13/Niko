import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('colorrole-expiry')
        .setDescription("Check when a member's temporary color role expires")
        .addUserOption(option =>
            option
                .setName('member')
                .setDescription('Member whose color role expiry you want to check')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        if (!interaction.inGuild()) {
            throw createError(
                'Server only',
                ErrorTypes.VALIDATION,
                'This command can only be used inside a server.'
            );
        }

        const isOwner = interaction.guild.ownerId === interaction.user.id;
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isAdmin) {
            throw createError(
                'Permission denied',
                ErrorTypes.PERMISSION,
                'Only the server owner or an administrator can use this command.'
            );
        }

        const member = interaction.options.getMember('member');

        if (!member) {
            throw createError(
                'Member not found',
                ErrorTypes.VALIDATION,
                'That member could not be found in this server.'
            );
        }

        const userData = await getEconomyData(client, interaction.guildId, member.id);

        if (!userData) {
            throw createError(
                'Economy data unavailable',
                ErrorTypes.DATABASE,
                "This member's economy data could not be loaded."
            );
        }

        const activeColorRole = userData.activeColorRole;

        if (!activeColorRole?.expiresAt) {
            await InteractionHelper.safeReply(interaction, {
                content: `🎨 **${member.user.tag}** does not have an active temporary color role.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const expiresAt = Number(activeColorRole.expiresAt);

        if (!Number.isFinite(expiresAt)) {
            throw createError(
                'Invalid expiry data',
                ErrorTypes.DATABASE,
                'The member has color-role data, but its expiry timestamp is invalid.'
            );
        }

        const role = interaction.guild.roles.cache.get(activeColorRole.roleId);
        const roleName = role?.name || activeColorRole.roleName || 'Unknown Color Role';

        if (expiresAt <= Date.now()) {
            await InteractionHelper.safeReply(interaction, {
                content: `🎨 **${member.user.tag}**'s **${roleName}** color role is already expired and is waiting for the expiry checker to remove it.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const unixSeconds = Math.floor(expiresAt / 1000);

        await InteractionHelper.safeReply(interaction, {
            content:
                `🎨 **Color Role Expiry**\n\n` +
                `👤 **Member:** ${member}\n` +
                `🎭 **Role:** **${roleName}**\n` +
                `📅 **Expires:** <t:${unixSeconds}:F>\n` +
                `⏳ **Remaining:** <t:${unixSeconds}:R>`,
            flags: MessageFlags.Ephemeral
        });
    }, { command: 'colorrole-expiry' })
};
