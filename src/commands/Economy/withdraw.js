import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';

function isInventoryChannel(channel) {
    if (!channel?.name) return false;
    return channel.name.toLowerCase().replace(/[^a-z0-9]/g, '') === 'inventory';
}

export default {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw Souls from your bank to your wallet')
        .addIntegerOption(option => option.setName('amount').setDescription('Amount of Souls to withdraw').setRequired(true).setMinValue(1)),

    execute: withErrorHandling(async (interaction, config, client) => {
        if (!isInventoryChannel(interaction.channel)) {
            return interaction.reply({ content: '❌ Please use **/withdraw** in the **『Inventory』** channel.', ephemeral: true });
        }

        await InteractionHelper.safeDefer(interaction);

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const amountInput = interaction.options.getInteger('amount');
        const userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            throw createError('Failed to load economy data', ErrorTypes.DATABASE, 'Failed to load your economy data. Please try again later.', { userId, guildId });
        }

        let withdrawAmount = amountInput;
        if (withdrawAmount > userData.bank) withdrawAmount = userData.bank;

        if (withdrawAmount <= 0) {
            throw createError('Empty bank account', ErrorTypes.VALIDATION, 'Your bank account is empty.', { userId, bankBalance: userData.bank });
        }

        userData.wallet += withdrawAmount;
        userData.bank -= withdrawAmount;
        await setEconomyData(client, guildId, userId, userData);

        const embed = successEmbed('Withdrawal Successful', `You successfully withdrew **${withdrawAmount.toLocaleString()} ${SOULS_EMOJI} Souls** from your bank.`).addFields(
            { name: `${SOULS_EMOJI} New Wallet Balance`, value: `${userData.wallet.toLocaleString()} Souls`, inline: true },
            { name: '🏦 New Bank Balance', value: `${userData.bank.toLocaleString()} Souls`, inline: true }
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'withdraw' })
};