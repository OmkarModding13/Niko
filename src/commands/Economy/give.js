import {
    SlashCommandBuilder,
    MessageFlags
} from 'discord.js';

import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_EMOJI = '<:Total:1547545479628333086>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';

export default {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give Souls or Shards to a member.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The member who will receive the currency.')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to give.')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000000000)
        )
        .addStringOption(option =>
            option
                .setName('currency')
                .setDescription('Choose the currency to give.')
                .setRequired(false)
                .addChoices(
                    { name: 'Souls', value: 'souls' },
                    { name: 'Shards', value: 'shards' }
                )
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
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

        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const currency = interaction.options.getString('currency') || 'souls';
        const guildId = interaction.guildId;

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
                'You cannot give currency to a bot.'
            );
        }

        if (!amount || amount < 1) {
            throw createError(
                'Invalid Amount',
                ErrorTypes.VALIDATION,
                'The amount must be at least 1.'
            );
        }

        const userData = await getEconomyData(client, guildId, targetUser.id);

        if (!userData) {
            throw createError(
                'Economy Error',
                ErrorTypes.DATABASE_ERROR,
                'Could not load the user economy data.'
            );
        }

        if (currency === 'shards') {
            const oldShards = userData.shards || 0;
            const newShards = oldShards + amount;
            userData.shards = newShards;

            await setEconomyData(client, guildId, targetUser.id, userData);

            const embed = successEmbed(
                'Shards Added',
                `${targetUser} received **${amount.toLocaleString()} Shards**.`
            );

            embed.addFields(
                {
                    name: 'Amount',
                    value: `${SHARD_EMOJI} ${amount.toLocaleString()} Shards`,
                    inline: true
                },
                {
                    name: 'New Shards',
                    value: `${SHARD_EMOJI} ${newShards.toLocaleString()} Shards`,
                    inline: true
                }
            );

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const oldBalance = userData.wallet || 0;
        const newBalance = oldBalance + amount;
        userData.wallet = newBalance;

        await setEconomyData(client, guildId, targetUser.id, userData);

        const embed = successEmbed(
            'Souls Added',
            `${targetUser} received **${amount.toLocaleString()} Souls**.`
        );

        embed.addFields(
            {
                name: 'Amount',
                value: `${SOULS_EMOJI} ${amount.toLocaleString()} Souls`,
                inline: true
            },
            {
                name: 'New Balance',
                value: `${TOTAL_EMOJI} ${newBalance.toLocaleString()} Souls`,
                inline: true
            }
        );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }, {
        command: 'give'
    })
};
