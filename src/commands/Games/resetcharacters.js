import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getEconomyPrefix } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('resetcharacters')
        .setDescription('Reset a specific member\'s character collection.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The member whose character collection should be cleared.')
                .setRequired(true)
        ),

    category: 'Games',

    async execute(interaction, config, client) {
        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (interaction.guild.ownerId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ Only the server owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const target = interaction.options.getUser('user');
        const guildId = interaction.guildId;
        const userId = target.id;

        const userData = await getEconomyData(client, guildId, userId);
        if (!userData) {
            return interaction.editReply({
                content: `❌ No economy data found for <@${userId}>.`
            });
        }

        if (!userData.characters || typeof userData.characters !== 'object' || Object.keys(userData.characters).length === 0) {
            return interaction.editReply({
                content: `ℹ️ <@${userId}> does not have any characters in their inventory.`
            });
        }

        userData.characters = {};
        await setEconomyData(client, guildId, userId, userData);

        return interaction.editReply({
            content: `✅ Cleared the character collection of <@${userId}>.\n\nOnly that user's characters were removed. Souls, Shards, bank data, levels and other economy data were left unchanged.`
        });
    }
};
