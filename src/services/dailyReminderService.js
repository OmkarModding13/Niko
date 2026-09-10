import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { logger } from '../utils/logger.js';

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

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

                    if (now < readyAt) continue;

                    const user = await client.users.fetch(userId).catch(() => null);

                    if (!user) continue;

                    await user.send({
                        embeds: [{
                            title: '🔔 Daily Reward Ready!',
                            description:
                                `Your daily reward is ready to claim!\n\n` +
                                `Use **/daily** in <#${guild.channels.cache.find(c => c.isTextBased?.())?.id || ''}> to claim your Souls.`,
                            color: 0x5865F2
                        }]
                    });

                    // Prevent repeated DMs every minute.
                    // The next reminder will be scheduled from the next daily claim.
                    userData.reminderNextAt = readyAt + DAILY_COOLDOWN;

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
