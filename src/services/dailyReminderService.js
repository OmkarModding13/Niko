import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { logger } from '../utils/logger.js';
import { Mutex } from '../utils/mutex.js';

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const COMMAND_CHANNEL_ID = '1551192004241793084';

export async function checkDailyReminders(client) {
    if (!client?.db || !client?.guilds) return;

    const now = Date.now();

    for (const [guildId] of client.guilds.cache) {
        try {
            // Read all economy rows in one PostgreSQL query instead of
            // list-then-get (N+1) queries every minute.
            const entries =
                typeof client.db.listEconomyEntries === 'function'
                    ? await client.db.listEconomyEntries(guildId)
                    : [];

            for (const entry of entries) {
                const userId = entry?.userId;
                const snapshot = entry?.data;

                if (!userId || !snapshot?.reminderEnabled) {
                    continue;
                }

                const lastDaily = Number(snapshot.lastDaily) || 0;
                const readyAt = lastDaily + DAILY_COOLDOWN;
                const scheduledAt = Number(snapshot.reminderNextAt) || 0;

                // A claim happened after the reminder was scheduled.
                if (!scheduledAt || readyAt > scheduledAt) {
                    await Mutex.runExclusive(
                        `economy-guild:${guildId}`,
                        async () => {
                            const userData = await getEconomyData(client, guildId, userId);
                            if (!userData?.reminderEnabled) return;

                            const freshLastDaily = Number(userData.lastDaily) || 0;
                            const freshReadyAt = freshLastDaily + DAILY_COOLDOWN;
                            const freshScheduledAt = Number(userData.reminderNextAt) || 0;

                            if (!freshScheduledAt || freshReadyAt > freshScheduledAt) {
                                userData.reminderNextAt = freshReadyAt;
                                await setEconomyData(client, guildId, userId, userData);
                            }
                        }
                    );
                    continue;
                }

                if (now < scheduledAt) {
                    continue;
                }

                // Re-read only users whose reminder is actually due. The same
                // guild lock used by economy commands prevents a stale write
                // from overwriting a concurrent /daily transaction.
                await Mutex.runExclusive(
                    `economy-guild:${guildId}`,
                    async () => {
                        const userData = await getEconomyData(client, guildId, userId);
                        if (!userData?.reminderEnabled) return;

                        const freshLastDaily = Number(userData.lastDaily) || 0;
                        const freshReadyAt = freshLastDaily + DAILY_COOLDOWN;
                        let nextReminderAt = Number(userData.reminderNextAt) || 0;

                        if (!nextReminderAt || freshReadyAt > nextReminderAt) {
                            userData.reminderNextAt = freshReadyAt;
                            nextReminderAt = freshReadyAt;
                            await setEconomyData(client, guildId, userId, userData);
                        }

                        if (now < nextReminderAt) {
                            return;
                        }

                        const user = await client.users.fetch(userId).catch(() => null);
                        if (!user) return;

                        try {
                            await user.send({
                                embeds: [{
                                    title: '🔔 Daily Reward Ready!',
                                    description:
                                        'Your daily reward is ready to claim!\\n\\n' +
                                        `Use **/daily** in <#${COMMAND_CHANNEL_ID}> to claim your Souls.`,
                                    color: 0x5865F2
                                }]
                            });

                            userData.reminderNextAt =
                                nextReminderAt + DAILY_COOLDOWN;

                            await setEconomyData(
                                client,
                                guildId,
                                userId,
                                userData
                            );

                            logger.info(
                                `[DAILY_REMINDER] Sent reminder to ${userId} in guild ${guildId}`
                            );
                        } catch (error) {
                            const discordCode = error?.code;

                            if (discordCode === 50007 || discordCode === 50278) {
                                userData.reminderNextAt =
                                    nextReminderAt + DAILY_COOLDOWN;

                                await setEconomyData(
                                    client,
                                    guildId,
                                    userId,
                                    userData
                                );

                                logger.warn(
                                    `[DAILY_REMINDER] Skipped unreachable user ${userId} in guild ${guildId} (Discord rejected the DM: ${discordCode})`
                                );
                                return;
                            }

                            throw error;
                        }
                    }
                );
            }
        } catch (error) {
            logger.error(
                `[DAILY_REMINDER] Failed for guild ${guildId}:`,
                error
            );
        }
    }
}
