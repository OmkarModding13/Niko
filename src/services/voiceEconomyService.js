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

                for (const [userId, member] of members) {
                    const userData = await getEconomyData(
                        client,
                        guildId,
                        userId
                    );

                    if (!userData) continue;

                    // Track only eligible voice time. This prevents a user
                    // from earning instantly after a bot restart or after
                    // staying self-muted/deafened for a long period.
                    const eligibleSince = Number(userData.voiceEligibleSince || 0);

                    if (
                        members.size < 2 ||
                        member.voice.selfMute ||
                        member.voice.selfDeaf
                    ) {
                        userData.voiceEligibleSince = now;
                        await setEconomyData(client, guildId, userId, userData);
                        continue;
                    }

                    if (!eligibleSince) {
                        userData.voiceEligibleSince = now;
                        await setEconomyData(client, guildId, userId, userData);
                        continue;
                    }

                    if (now - eligibleSince < VOICE_INTERVAL) {
                        continue;
                    }

                    // Give 1 Soul for each completed 15-minute eligible interval.
                    userData.wallet =
                        (userData.wallet || 0) + VOICE_REWARD;
                    userData.lastVoiceReward = now;
                    userData.voiceEligibleSince = now;

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
