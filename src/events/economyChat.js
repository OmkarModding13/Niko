import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import {
    getEconomyData,
    setEconomyData
} from '../utils/economy.js';

const CHAT_REWARD = 2;
const CHAT_COOLDOWN = 10 * 60 * 1000; // 10 minutes

// Temporary anti-spam tracking
const recentMessages = new Map();

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        try {
            if (message.author.bot || !message.guild) return;

            if (!message.content || message.content.trim().length === 0) {
                return;
            }

            const guildId = message.guild.id;
            const userId = message.author.id;
            const now = Date.now();

            const userKey = `${guildId}:${userId}`;
            const messageContent = message.content.trim().toLowerCase();

            // Prevent repeated identical messages
            const previous = recentMessages.get(userKey);

            if (previous?.content === messageContent) {
                return;
            }

            recentMessages.set(userKey, {
                content: messageContent,
                timestamp: now
            });

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

            // Add Souls directly to the loaded data
            userData.wallet = (userData.wallet || 0) + CHAT_REWARD;
            userData.lastChatReward = now;

            // Save everything together
            await setEconomyData(
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
