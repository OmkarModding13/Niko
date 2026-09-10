import { SlashCommandBuilder } from 'discord.js';
import {
    createEmbed,
    errorEmbed,
    successEmbed,
    infoEmbed,
    warningEmbed
} from '../../utils/embeds.js';
import {
    getEconomyData,
    setEconomyData
} from '../../utils/economy.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { formatDuration } from '../../utils/embeds.js';
import {
    withErrorHandling,
    createError,
    ErrorTypes
} from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { botConfig } from '../../config/bot.js';

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const DAILY_AMOUNT = 25;
const PREMIUM_BONUS_PERCENTAGE = 0.1;

export default {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily Souls reward'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);

        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        logger.debug(
            `[ECONOMY] Daily claimed started for ${userId}`,
            {
                userId,
                guildId
            }
        );

        const userData = await getEconomyData(
            client,
            guildId,
            userId
        );

        if (!userData) {
            throw createError(
                'Failed to load economy data for daily',
                ErrorTypes.DATABASE,
                'Failed to load your economy data. Please try again later.',
                {
                    userId,
                    guildId
                }
            );
        }

        const lastDaily = userData.lastDaily || 0;
        const dailyStreak = userData.dailyStreak || 0;

        /*
         * DAILY COOLDOWN
         */

        if (now < lastDaily + DAILY_COOLDOWN) {
            const timeRemaining =
                lastDaily + DAILY_COOLDOWN - now;

            const embed = warningEmbed(
                '⏳ Already Claimed!',
                `You already claimed your daily reward.\n\nCome back in **${formatDuration(timeRemaining)}**.`
            );

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [embed]
                }
            );

            return;
        }

        /*
         * DAILY STREAK
         */

        let newDailyStreak = dailyStreak;

        if (lastDaily === 0) {
            newDailyStreak = 1;
        } else if (
            now - lastDaily <= 48 * 60 * 60 * 1000
        ) {
            newDailyStreak += 1;
        } else {
            newDailyStreak = 1;
        }

        /*
         * GUILD CONFIG
         */

        const guildConfig = await getGuildConfig(
            client,
            guildId
        );

        const PREMIUM_ROLE_ID =
            guildConfig.premiumRoleId;

        /*
         * BASE DAILY REWARD
         */

        let earned = DAILY_AMOUNT;

        /*
         * STREAK BONUSES
         */

        if (newDailyStreak % 3 === 0) {
            earned += 15;
        }

        if (newDailyStreak % 7 === 0) {
            earned += 40;
        }

        if (newDailyStreak % 30 === 0) {
            earned += 150;
        }

        /*
         * BONUS MESSAGE
         */

        let bonusMessage = '';

        if (newDailyStreak % 30 === 0) {
            bonusMessage +=
                `\n🔥 **30-Day Streak Bonus:** +150 Souls`;
        } else if (newDailyStreak % 7 === 0) {
            bonusMessage +=
                `\n🔥 **7-Day Streak Bonus:** +40 Souls`;
        } else if (newDailyStreak % 3 === 0) {
            bonusMessage +=
                `\n🔥 **3-Day Streak Bonus:** +15 Souls`;
        }

        /*
         * PREMIUM BONUS
         */

        let hasPremiumRole = false;

        if (
            PREMIUM_ROLE_ID &&
            interaction.member &&
            interaction.member.roles.cache.has(
                PREMIUM_ROLE_ID
            )
        ) {
            const bonusAmount = Math.floor(
                DAILY_AMOUNT *
                PREMIUM_BONUS_PERCENTAGE
            );

            earned += bonusAmount;

            bonusMessage +=
                `\n✨ **Premium Bonus:** +${bonusAmount.toLocaleString()} Souls`;

            hasPremiumRole = true;
        }

        /*
         * SAVE ECONOMY DATA
         */

        userData.wallet =
            (userData.wallet || 0) + earned;

        userData.lastDaily = now;
        userData.dailyStreak = newDailyStreak;

        await setEconomyData(
            client,
            guildId,
            userId,
            userData
        );

        logger.info(
            `[ECONOMY_TRANSACTION] Daily claimed`,
            {
                userId,
                guildId,
                amount: earned,
                newWallet: userData.wallet,
                dailyStreak: newDailyStreak,
                hasPremium: hasPremiumRole,
                timestamp: new Date().toISOString()
            }
        );

        /*
         * SUCCESS EMBED
         */

        const embed = successEmbed(
            '✅ Daily Claimed!',
            `You have claimed your daily **${botConfig.economy.currency.emoji} ${earned.toLocaleString()} Souls**!${bonusMessage}`
        )
            .addFields(
                {
                    name: '🔥 Daily Streak',
                    value: `**${newDailyStreak} days**`,
                    inline: true
                },
                {
                    name: `${botConfig.economy.currency.emoji} New Souls Balance`,
                    value: `${userData.wallet.toLocaleString()} Souls`,
                    inline: true
                }
            )
            .setFooter({
                text: hasPremiumRole
                    ? 'Next claim in 24 hours. (Premium Active)'
                    : 'Next claim in 24 hours.'
            });

        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [embed]
            }
        );
    }, {
        command: 'daily'
    })
};
