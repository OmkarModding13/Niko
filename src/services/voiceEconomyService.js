import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { logger } from '../utils/logger.js';

const VOICE_REWARD = 1;
const VOICE_INTERVAL = 15 * 60 * 1000; // 15 minutes

export async function checkVoiceEconomy(client) {
    if (!client?.guilds) return;

    const now = Date.now();

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            for (const [channelId, channel] of guild.channels.cache) {
                if (!channel?.isVoiceBased?.()) continue;

                const members = channel.members.filter(
                    member => !member.user.bot
                );

                // Need at least 2 real users
                if (members.size < 2) continue;

                for (const [userId, member] of members) {
                    // User must not be self-muted/deafened
                    if (member.voice.selfMute || member.voice.selfDeaf) {
                        continue;
                    }

                    const userData = await getEconomyData(
                        client,
                        guildId,
                        userId
                    );

                    if (!userData) continue;

                    const lastVoiceReward =
                        userData.lastVoiceReward || 0;

                    // 15-minute cooldown
                    if (now - lastVoiceReward < VOICE_INTERVAL) {
                        continue;
                    }

                    // Give 1 Soul
                    userData.wallet =
                        (userData.wallet || 0) + VOICE_REWARD;

                    userData.lastVoiceReward = now;

                    await setEconomyData(
                        client,
                        guildId,
                        userId,
                        userData
                    );

                    logger.info(
                        `[ECONOMY_VOICE] ${member.user.tag} earned ${VOICE_REWARD} Soul`
                    );
                }
            }
        } catch (error) {
            logger.error(
                `[ECONOMY_VOICE] Failed for guild ${guildId}:`,
                error
            );
        }
    }
}
