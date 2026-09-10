import { MessageFlags } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

async function handleDailyReminderStop(interaction, client, args) {
    try {
        await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral
        });

        const userId = args[0];

        if (interaction.user.id !== userId) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    warningEmbed(
                        '❌ Not Your Reminder',
                        'You can only stop your own daily reminders.'
                    )
                ]
            });
            return;
        }

        if (!interaction.guild) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    warningEmbed(
                        '⚠️ Reminder Error',
                        'This button can only be used in a server.'
                    )
                ]
            });
            return;
        }

        const guildId = interaction.guild.id;

        const userData = await getEconomyData(
            client,
            guildId,
            userId
        );

        if (!userData) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    warningEmbed(
                        '⚠️ Reminder Error',
                        'Could not load your economy data.'
                    )
                ]
            });
            return;
        }

        userData.reminderEnabled = false;
        userData.reminderNextAt = 0;

        await setEconomyData(
            client,
            guildId,
            userId,
            userData
        );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    '🔕 Daily Reminders Stopped',
                    'You will no longer receive daily reward reminders.\n\nUse `/remindme` anytime to enable them again.'
                )
            ]
        });

        logger.info(
            `[DAILY_REMINDER] Disabled for ${interaction.user.tag}`
        );

    } catch (error) {
        logger.error(
            '[DAILY_REMINDER] Failed to stop reminder:',
            error
        );

        await handleInteractionError(
            interaction,
            error,
            {
                command: 'remindme',
                action: 'stop'
            }
        );
    }
}

export default {
    name: 'daily_reminder_stop',
    execute: handleDailyReminderStop
};
