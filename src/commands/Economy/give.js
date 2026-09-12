import {
    SlashCommandBuilder,
    MessageFlags
} from 'discord.js';

import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_EMOJI = '<:Total:1547545479628333086>';

export default {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give Souls to a member.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The member who will receive the Souls.')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of Souls to give.')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000000000)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        /*
         * SERVER OWNER ONLY
         */
        if (!interaction.guild) {
            throw createError(
                'Server Only',
                ErrorTypes.VALIDATION,
                'This command can only be used inside a server.'
            );
        }

        if (interaction.guild.ownerId !== interaction.user.id) {
            throw createError(
                'No Permission',
                ErrorTypes.PERMISSION,
                'Only the server owner can use this command.'
            );
        }

        const deferred =
            await InteractionHelper.safeDefer(interaction);

        if (!deferred) return;

        const targetUser =
            interaction.options.getUser('user');

        const amount =
            interaction.options.getInteger('amount');

        const guildId =
            interaction.guildId;

        if (!targetUser) {
            throw createError(
                'Invalid User',
                ErrorTypes.VALIDATION,
                'Please select a valid member.'
            );
        }

        if (targetUser.bot) {
            throw createError(
                'Invalid User',
                ErrorTypes.VALIDATION,
                'You cannot give Souls to a bot.'
            );
        }

        if (!amount || amount < 1) {
            throw createError(
                'Invalid Amount',
                ErrorTypes.VALIDATION,
                'The amount must be at least 1 Soul.'
            );
        }

        const userData =
            await getEconomyData(
                client,
                guildId,
                targetUser.id
            );

        if (!userData) {
            throw createError(
                'Economy Error',
                ErrorTypes.DATABASE_ERROR,
                'Could not load the user economy data.'
            );
        }

        const oldBalance =
            userData.wallet || 0;

        const newBalance =
            oldBalance + amount;

        userData.wallet =
            newBalance;

        await setEconomyData(
            client,
            guildId,
            targetUser.id,
            userData
        );

        const embed =
            successEmbed(
                'Souls Added',
                `${targetUser} received **${amount.toLocaleString()} Souls**.`
            );

        embed.addFields(
            {
                name: 'Amount',
                value:
                    `${SOULS_EMOJI} ${amount.toLocaleString()} Souls`,
                inline: true
            },
            {
                name: 'New Balance',
                value:
                    `${TOTAL_EMOJI} ${newBalance.toLocaleString()} Souls`,
                inline: true
            }
        );

        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            }
        );
    }, {
        command: 'give'
    })
};
