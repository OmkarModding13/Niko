import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed, buildUserErrorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';

export default {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit Souls from your wallet into your Soul Bank')
        .addStringOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of Souls to deposit, or "all"')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const amountInput = interaction.options.getString('amount').trim();
        const userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            throw createError(
                'Failed to load economy data',
                ErrorTypes.DATABASE,
                'Failed to load your economy data. Please try again later.',
                { userId, guildId }
            );
        }

        const maxBank = getMaxBankCapacity(userData);
        let depositAmount;

        if (amountInput.toLowerCase() === 'all') {
            depositAmount = Number(userData.wallet || 0);
        } else {
            depositAmount = parseInt(amountInput, 10);
            if (isNaN(depositAmount) || depositAmount <= 0) {
                throw createError(
                    'Invalid deposit amount',
                    ErrorTypes.VALIDATION,
                    `Please enter a valid Souls amount or **all**.`,
                    { amountInput, userId }
                );
            }
        }

        if (depositAmount <= 0 || userData.wallet <= 0) {
            throw createError(
                'Zero deposit amount',
                ErrorTypes.VALIDATION,
                `You don't have any ${SOULS_EMOJI} **Souls** in your wallet to deposit.`,
                { userId, walletBalance: userData.wallet }
            );
        }

        if (depositAmount > userData.wallet) {
            depositAmount = userData.wallet;
            await interaction.followUp({
                embeds: [
                    buildUserErrorEmbed(
                        'validation',
                        `You tried to deposit more than you have. Depositing your remaining **${depositAmount.toLocaleString()} ${SOULS_EMOJI} Souls**.`
                    )
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        const availableSpace = maxBank - userData.bank;
        if (availableSpace <= 0) {
            throw createError(
                'Bank is full',
                ErrorTypes.VALIDATION,
                `Your Soul Bank is full (**${maxBank.toLocaleString()} Souls**). Purchase a **Bank Upgrade** to increase your capacity.`,
                { maxBank, currentBank: userData.bank, userId }
            );
        }

        if (depositAmount > availableSpace) {
            depositAmount = availableSpace;
            await interaction.followUp({
                embeds: [
                    buildUserErrorEmbed(
                        'validation',
                        `Your bank only has space for **${depositAmount.toLocaleString()} ${SOULS_EMOJI} Souls**. The rest remains in your wallet.`
                    )
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (depositAmount <= 0) {
            throw createError(
                'No deposit space',
                ErrorTypes.VALIDATION,
                'There is no available bank space for this deposit.',
                { depositAmount, availableSpace, userId }
            );
        }

        userData.wallet -= depositAmount;
        userData.bank += depositAmount;
        await setEconomyData(client, guildId, userId, userData);

        const embed = successEmbed(
            'Deposit Successful',
            `You deposited **${depositAmount.toLocaleString()} ${SOULS_EMOJI} Souls** into your Soul Bank.`
        ).addFields(
            {
                name: `${SOULS_EMOJI} Wallet`,
                value: `${userData.wallet.toLocaleString()} Souls`,
                inline: true,
            },
            {
                name: '🏦 Soul Bank',
                value: `${userData.bank.toLocaleString()} / ${maxBank.toLocaleString()} Souls`,
                inline: true,
            }
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'deposit' })
};
