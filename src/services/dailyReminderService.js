import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { logger } from '../utils/logger.js';

const DAILY_COOLDOWN = 2 * 60 * 1000;
const COMMAND_CHANNEL_ID = '1547531709959118911';

export async function checkDailyReminders(client) {
    if (!client?.db || !client?.guilds) return;

    const now = Date.now();

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const prefix = `guild:${guildId}:economy:`;

            let keys = await client.db.list(prefix);

            if (!Array.isArray(keys)) {
                if (keys && typeof keys === 'object') {
                    keys = Object.keys(keys).filter(key =>
                        key.startsWith(prefix)
                    );
                } else {
                    continue;
                }
            }

            for (const key of keys) {
                try {
                    const userId = key.replace(prefix, '');

                    const userData = await getEconomyData(
                        client,
                        guildId,
                        userId
                    );

                    if (!userData?.reminderEnabled) continue;

                    const lastDaily = userData.lastDaily || 0;
                    const readyAt = lastDaily + DAILY_COOLDOWN;

                    // If the user has claimed /daily since the last
                    // reminder was scheduled, move the reminder forward.
                    if (
                        !userData.reminderNextAt ||
                        readyAt > userData.reminderNextAt
                    ) {
                        userData.reminderNextAt = readyAt;

                        await setEconomyData(
                            client,
                            guildId,
                            userId,
                            userData
                        );

                        continue;
                    }

                    const nextReminderAt = userData.reminderNextAt;

                    // Daily reward is not ready for reminder yet.
                    if (now < nextReminderAt) continue;

                    const user = await client.users
                        .fetch(userId)
                        .catch(() => null);

                    if (!user) continue;

                    await user.send({
                        embeds: [{
                            title: '🔔 Daily Reward Ready!',
                            description:
                                `Your daily reward is ready to claim!\n\n` +
                                `Use **/daily** in <#${COMMAND_CHANNEL_ID}> to claim your Souls.`,
                            color: 0x5865F2
                        }]
                    });

                    // Schedule the next reminder for the next
                    // 24-hour cycle so it cannot DM every minute.
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
                    logger.error(
                        `[DAILY_REMINDER] Failed for key ${key}:`,
                        error
                    );
                }
            }

        } catch (error) {
            logger.error(
                `[DAILY_REMINDER] Failed for guild ${guildId}:`,
                error
            );
        }
    }
}
