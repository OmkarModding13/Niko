import {
    SlashCommandBuilder,
    MessageFlags
} from 'discord.js';

import { addLevelXp } from '../../services/leveling/leveling.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('xpgive')
        .setDescription('Give XP to a user for leveling tests')
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('The user to give XP to')
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName('xp')
                .setDescription('Amount of XP to give')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000000)
        )
        .setDMPermission(false),

    category: 'Leveling',

    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        // Owner-only test command.
        if (interaction.user.id !== interaction.guild.ownerId) {
            await InteractionHelper.safeEditReply(interaction, {
                content: '❌ Only the server owner can use this test command.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const xp = interaction.options.getInteger('xp');

        const result = await addLevelXp(
            client,
            interaction.guildId,
            targetUser.id,
            xp
        );

        if (!result) {
            await InteractionHelper.safeEditReply(interaction, {
                content: '❌ Failed to add XP.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            content:
                `✅ Added **${xp} XP** to ${targetUser}.\n` +
                `**Level:** ${result.level}\n` +
                `**XP:** ${result.xp}/100`,
            flags: MessageFlags.Ephemeral
        });
    }
};
