import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { logger } from '../utils/logger.js';
import { Mutex } from '../utils/mutex.js';

export async function checkColorRoleExpiry(client) {
    if (!client?.db || !client?.guilds) return;

    const now = Date.now();

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            // Bulk load economy rows so the once-per-minute expiry scan does
            // not perform one SELECT for every economy key.
            const entries =
                typeof client.db.listEconomyEntries === 'function'
                    ? await client.db.listEconomyEntries(guildId)
                    : [];

            for (const entry of entries) {
                const userId = entry?.userId;
                const snapshot = entry?.data;
                const colorRole = snapshot?.activeColorRole;

                if (!userId || !colorRole?.expiresAt || now < colorRole.expiresAt) {
                    continue;
                }

                await Mutex.runExclusive(
                    \`economy-guild:\${guildId}\`,
                    async () => {
                        const userData = await getEconomyData(client, guildId, userId);
                        const freshRole = userData?.activeColorRole;

                        if (!freshRole?.expiresAt || now < freshRole.expiresAt) {
                            return;
                        }

                        const role = guild.roles.cache.get(freshRole.roleId);

                        if (role) {
                            const member =
                                guild.members.cache.get(userId) ||
                                await guild.members.fetch(userId).catch(() => null);

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
                            \`[COLOR_ROLE_EXPIRY] Removed expired color role from \${userId} in guild \${guildId}\`
                        );
                    }
                );
            }
        } catch (error) {
            logger.error(
                \`[COLOR_ROLE_EXPIRY] Failed for guild \${guildId}:\`,
                error
            );
        }
    }
}
