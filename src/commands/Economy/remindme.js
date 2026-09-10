import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import {
    successEmbed,
    infoEmbed,
    warningEmbed,
    formatDuration
} from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

export default {
    data: new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Enable daily reward reminders'),

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
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        warningEmbed(
                            '⚠️ Reminder Failed',
                            'Could not load your economy data.'
                        )
                    ]
                });
                return;
            }

            const now = Date.now();
            const lastDaily = userData.lastDaily || 0;
            const readyAt = lastDaily + DAILY_COOLDOWN;

            userData.reminderEnabled = true;

            // If daily is already ready, schedule it immediately.
            if (now >= readyAt) {
                userData.reminderNextAt = now;
            } else {
                userData.reminderNextAt = readyAt;
            }

            await setEconomyData(
                client,
                guildId,
                userId,
                userData
            );

            const stopButton = new ButtonBuilder()
                .setCustomId(`daily_reminder_stop:${userId}`)
                .setLabel('Stop Reminders')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder()
                .addComponents(stopButton);

            if (now >= readyAt) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            '🔔 Daily Reminders Enabled',
                            'Your daily reward is already ready!\n\nI will send you a DM reminder.'
                        )
                    ],
                    components: [row]
                });

                return;
            }

            const timeRemaining = readyAt - now;

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    infoEmbed(
                        '🔔 Daily Reminders Enabled',
                        `I'll send you a DM when your daily reward is ready.\n\n**Next reminder:** ${formatDuration(timeRemaining)}`
                    )
                ],
                components: [row]
            });

            logger.info(
                `[DAILY_REMINDER] Enabled for ${interaction.user.tag}`
            );

        } catch (error) {
            logger.error(
                '[DAILY_REMINDER] Failed to enable reminder:',
                error
            );

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    warningEmbed(
                        '⚠️ Reminder Failed',
                        'I could not enable your daily reminder. Please try again.'
                    )
                ]
            });
        }
    }
};
