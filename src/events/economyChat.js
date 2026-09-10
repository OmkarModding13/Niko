import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getEconomyData, addMoney } from '../utils/economy.js';

const CHAT_REWARD = 2;
const CHAT_COOLDOWN = 10 * 60 * 1000; // 10 minutes

// Per-user temporary anti-spam tracking
const recentMessages = new Map();

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        try {
            // Ignore bots, DMs and empty messages
            if (message.author.bot || !message.guild) return;

            if (!message.content || message.content.trim().length === 0) {
                return;
            }

            const guildId = message.guild.id;
            const userId = message.author.id;
            const now = Date.now();

            // Anti-spam:
            // Same exact message repeatedly won't generate rewards
            const userKey = `${guildId}:${userId}`;
            const messageContent = message.content.trim().toLowerCase();

            const previous = recentMessages.get(userKey);

            if (previous?.content === messageContent) {
                return;
            }

            recentMessages.set(userKey, {
                content: messageContent,
                timestamp: now
            });

            // Get economy data
            const userData = await getEconomyData(
                client,
                guildId,
                userId
            );

            if (!userData) return;

            const lastReward = userData.lastChatReward || 0;

            // 10-minute cooldown
            if (now - lastReward < CHAT_COOLDOWN) {
                return;
            }

            // Give 2 Souls
            await addMoney(
                client,
                guildId,
                userId,
                CHAT_REWARD
            );

            // Save reward timestamp
            userData.lastChatReward = now;

            await setEconomyChatData(
                client,
                guildId,
                userId,
                userData
            );

            logger.info(
                `[ECONOMY_CHAT] ${message.author.tag} earned ${CHAT_REWARD} Souls`
            );

        } catch (error) {
            logger.error(
                'Error handling chat economy:',
                error
            );
        }
    }
};

async function setEconomyChatData(
    client,
    guildId,
    userId,
    data
) {
    const { setEconomyData } = await import('../utils/economy.js');

    await setEconomyData(
        client,
        guildId,
        userId,
        data
    );
}
