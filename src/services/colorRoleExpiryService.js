import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { logger } from '../utils/logger.js';

export async function checkColorRoleExpiry(client) {
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

                    if (!userData?.activeColorRole) {
                        continue;
                    }

                    const colorRole = userData.activeColorRole;

                    if (!colorRole.expiresAt) {
                        continue;
                    }

                    if (now < colorRole.expiresAt) {
                        continue;
                    }

                    const role = guild.roles.cache.get(
                        colorRole.roleId
                    );

                    if (role) {
                        const member = await guild.members
                            .fetch(userId)
                            .catch(() => null);

                        if (member && member.roles.cache.has(role.id)) {
                            await member.roles.remove(
                                role,
                                'Temporary shop color role expired'
                            );
                        }
                    }

                    userData.activeColorRole = null;

                    await setEconomyData(
                        client,
                        guildId,
                        userId,
                        userData
                    );

                    logger.info(
                        `[COLOR_ROLE_EXPIRY] Removed expired color role from ${userId} in guild ${guildId}`
                    );

                } catch (error) {
                    logger.error(
                        `[COLOR_ROLE_EXPIRY] Failed for key ${key}:`,
                        error
                    );
                }
            }

        } catch (error) {
            logger.error(
                `[COLOR_ROLE_EXPIRY] Failed for guild ${guildId}:`,
                error
            );
        }
    }
}
