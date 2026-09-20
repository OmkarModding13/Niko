import { botConfig } from '../../config/bot.js';
import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your or someone else's balance")
        .addUserOption(option =>
            option.setName('user').setDescription('User to check balance for').setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {

        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userOption = interaction.options.getUser('user');
        const targetUser = userOption || interaction.user;
        const guildId = interaction.guildId;

        logger.info(`[ECONOMY] Balance check - userOption: ${userOption?.id || 'null'}, targetUser: ${targetUser.id}, guildId: ${guildId}`);

        if (targetUser.bot) {
            throw createError('Bot user queried for balance', ErrorTypes.VALIDATION, "Bots don't have an economy balance.");
        }

        const userData = await getEconomyData(client, guildId, targetUser.id);
        if (!userData) {
            throw createError('Failed to load economy data', ErrorTypes.DATABASE, 'Failed to load economy data. Please try again later.', { userId: targetUser.id, guildId });
        }

        const maxBank = getMaxBankCapacity(userData);
        const wallet = typeof userData.wallet === 'number' ? userData.wallet : 0;
        const bank = typeof userData.bank === 'number' ? userData.bank : 0;
        const shards = Number(userData.shards || 0);

        const embed = createEmbed({
            title: `${targetUser.username}'s Balance`,
            description:
                `Here is the current financial status for ${targetUser.username}.\\n\\n` +
                `${SOULS_EMOJI} Use **/deposit** to move Souls from your wallet into your bank.\\n` +
                `${SOULS_EMOJI} Use **/withdraw** to move Souls from your bank back into your wallet.\\n` +
                `${SHARD_EMOJI} Use **/gacha** to spend Shards on character and rare rewards.`,
        }).addFields(
            { name: `${SOULS_EMOJI} Souls`, value: `${wallet.toLocaleString()} ${botConfig.economy.currency.namePlural}`, inline: true },
            { name: '🏦 Soul Bank', value: `${bank.toLocaleString()} / ${maxBank.toLocaleString()} ${botConfig.economy.currency.namePlural}`, inline: true },
            { name: `${TOTAL_SOULS_EMOJI} Total Souls`, value: `${(wallet + bank).toLocaleString()} ${botConfig.economy.currency.namePlural}`, inline: true },
            { name: `${SHARD_EMOJI} Shards`, value: `**${shards.toLocaleString()}**`, inline: true }
        ).setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        logger.info('[ECONOMY] Balance retrieved', { userId: targetUser.id, wallet, bank, shards });
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'balance' })
};