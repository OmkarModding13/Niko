import { SlashCommandBuilder } from 'discord.js';
import { getEconomyData } from '../../utils/economy.js';
import {
    successEmbed,
    infoEmbed,
    warningEmbed
} from '../../utils/embeds.js';
import { formatDuration } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

// Prevent duplicate reminders
const activeReminders = new Map();

export default {
    data: new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Get a DM reminder when your daily reward is ready'),

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction);

        if (!deferred) return;

        try {
            const guildId = interaction.guildId;
            const userId = interaction.user.id;

            const userData = await getEconomyData(
                client,
                guildId,
                userId
            );

            if (!userData) {
                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        embeds: [
                            warningEmbed(
                                '⚠️ Error',
                                'Could not load your economy data.'
                            )
                        ]
                    }
                );
                return;
            }

            const lastDaily = userData.lastDaily || 0;
            const readyAt = lastDaily + DAILY_COOLDOWN;
            const now = Date.now();

            // Daily is already ready
            if (now >= readyAt) {
                await InteractionHelper.safeEditReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                '✅ Daily Ready!',
                                'Your daily reward is already ready to claim!'
                            )
                        ]
                    }
                );
                return;
            }

            const timeRemaining = readyAt - now;
            const reminderKey = `${guildId}:${userId}`;

            // Cancel existing reminder
            if (activeReminders.has(reminderKey)) {
                clearTimeout(activeReminders.get(reminderKey));
            }

            const timer = setTimeout(async () => {
                try {
                    await interaction.user.send({
                        embeds: [
                            successEmbed(
                                '💀 Daily Reward Ready!',
                                'Your daily Souls reward is ready to claim!\n\nUse **/daily** to collect it.'
                            )
                        ]
                    });

                    logger.info(
                        `[DAILY_REMINDER] Sent reminder to ${interaction.user.tag}`
                    );
                } catch (error) {
                    logger.warn(
                        `[DAILY_REMINDER] Could not DM ${interaction.user.tag}`
                    );
                }

                activeReminders.delete(reminderKey);
            }, timeRemaining);

            activeReminders.set(reminderKey, timer);

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        infoEmbed(
                            '⏰ Reminder Set!',
                            `I'll send you a DM when your daily reward is ready.\n\n**Time remaining:** ${formatDuration(timeRemaining)}`
                        )
                    ]
                }
            );

        } catch (error) {
            logger.error(
                '[DAILY_REMINDER] Error setting reminder:',
                error
            );

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        warningEmbed(
                            '⚠️ Reminder Failed',
                            'I could not set your reminder. Please try again.'
                        )
                    ]
                }
            );
        }
    }
};
