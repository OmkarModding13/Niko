import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import {
    getEconomyData,
    setEconomyData
} from '../utils/economy.js';

const VOICE_REWARD = 1;
const VOICE_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Track active voice users
const voiceSessions = new Map();

export default {
    name: Events.VoiceStateUpdate,

    async execute(oldState, newState, client) {
        try {
            const member = newState.member || oldState.member;

            if (!member || member.user.bot) return;

            const guild = newState.guild || oldState.guild;
            if (!guild) return;

            const userId = member.id;
            const guildId = guild.id;

            // User joined/switched voice channel
            if (
                newState.channelId &&
                newState.channelId !== oldState.channelId
            ) {
                voiceSessions.set(`${guildId}:${userId}`, {
                    channelId: newState.channelId,
                    joinedAt: Date.now(),
                    lastReward: Date.now()
                });

                return;
            }

            // User left voice
            if (!newState.channelId && oldState.channelId) {
                voiceSessions.delete(`${guildId}:${userId}`);
                return;
            }

            // User changed mute/deafen state or stayed in voice
            if (newState.channelId) {
                await handleVoiceReward(
                    newState,
                    client,
                    voiceSessions
                );
            }

        } catch (error) {
            logger.error(
                'Error handling voice economy:',
                error
            );
        }
    }
};

async function handleVoiceReward(
    state,
    client,
    sessions
) {
    const member = state.member;

    if (!member || member.user.bot) return;

    const guild = state.guild;
    const channel = state.channel;

    if (!channel) return;

    const userId = member.id;
    const guildId = guild.id;
    const sessionKey = `${guildId}:${userId}`;

    const session = sessions.get(sessionKey);

    if (!session) return;

    // User must not be self-muted or self-deafened
    if (state.selfMute || state.selfDeaf) {
        return;
    }

    // Count actual non-bot members in the voice channel
    const otherMembers = channel.members.filter(
        otherMember =>
            otherMember.id !== userId &&
            !otherMember.user.bot
    );

    // At least one other real user must be present
    if (otherMembers.size < 1) {
        return;
    }

    const now = Date.now();

    // 15-minute reward cooldown
    if (now - session.lastReward < VOICE_INTERVAL) {
        return;
    }

    const userData = await getEconomyData(
        client,
        guildId,
        userId
    );

    if (!userData) return;

    // Give 1 Soul
    userData.wallet =
        (userData.wallet || 0) + VOICE_REWARD;

    // Update session reward time
    session.lastReward = now;

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
