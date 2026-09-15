import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getEconomyPrefix } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('resetcharacters')
        .setDescription('Reset all character collections in this server.'),

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

        const guildId = interaction.guildId;
        const prefix = getEconomyPrefix(guildId);
        const keys = await client.db.list(prefix);
        let resetCount = 0;

        for (const key of keys) {
            const userId = key.slice(prefix.length);
            if (!/^\d{17,20}$/.test(userId)) continue;

            const userData = await getEconomyData(client, guildId, userId);
            if (!userData?.characters || typeof userData.characters !== 'object') continue;

            const hadCharacters = Object.keys(userData.characters).length > 0;
            if (!hadCharacters) continue;

            userData.characters = {};
            await setEconomyData(client, guildId, userId, userData);
            resetCount += 1;
        }

        return interaction.editReply({
            content: `✅ Character reset complete. **${resetCount}** member collection${resetCount === 1 ? '' : 's'} cleared.\n\nAll Souls, Shards, bank data, levels and other economy data were left unchanged.`
        });
    }
};
