import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { isBotOwner } from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('removebankprotection')
        .setDescription('Remove bank protection from a specific user.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user whose bank protection should be removed.')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),

    category: 'Admin',

    async execute(interaction, config, client) {
        const isServerOwner = interaction.guild?.ownerId === interaction.user.id;
        const isAdministrator = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        const isOwner = isBotOwner(interaction.user.id) || isServerOwner;

        if (!isOwner && !isAdministrator) {
            return interaction.reply({
                content: '❌ You need **Administrator** permission to use this command.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                content: '❌ That user is not a member of this server.',
                ephemeral: true
            });
        }

        const userData = await getEconomyData(client, interaction.guildId, targetUser.id);
        const previousExpiry = Number(userData.bankProtectionExpiresAt || 0);

        userData.bankProtectionExpiresAt = 0;

        const saved = await setEconomyData(
            client,
            interaction.guildId,
            targetUser.id,
            userData
        );

        if (!saved) {
            return interaction.reply({
                content: '❌ Failed to remove the bank protection. Please try again.',
                ephemeral: true
            });
        }

        const hadActiveProtection = previousExpiry > Date.now();
        const status = hadActiveProtection
            ? '🛡️ Bank protection has been removed.'
            : 'ℹ️ This user did not have active bank protection.';

        return interaction.reply({
            content: `✅ **${targetUser.tag}** — ${status}`,
            ephemeral: true
        });
    }
};
