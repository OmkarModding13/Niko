import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import {
    getEconomyData,
    setEconomyData
} from '../utils/economy.js';

const CHAT_REWARD = 2;
const CHAT_COOLDOWN = 10 * 60 * 1000; // 10 minutes

const ACTIVITY_WINDOWS_REQUIRED = 6;
const ACTIVITY_BONUS = 20;
const STREAK_BONUS = 10;

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
            const activityStart = userData.activityStart || 0;
            const chatStreak = userData.chatStreak || 0;

            /*
             * First-ever qualifying message
             */
            if (lastReward === 0) {
                userData.wallet =
                    (userData.wallet || 0) + CHAT_REWARD;

                userData.lastChatReward = now;
                userData.activityStart = now;
                userData.lastActivity = now;
                userData.chatStreak = 1;

                await setEconomyData(
                    client,
                    guildId,
                    userId,
                    userData
                );

                logger.info(
                    `[ECONOMY_CHAT] ${message.author.tag} earned ${CHAT_REWARD} Souls`
                );

                return;
            }

            /*
             * Still inside the current 10-minute window.
             * No additional reward.
             */
            if (now - lastReward < CHAT_COOLDOWN) {
                return;
            }

            /*
             * Check whether a 10-minute activity window was missed.
             *
             * If more than 20 minutes passed since the previous
             * reward, at least one complete window was missed.
             */
            const timeSinceLastReward = now - lastReward;

            if (timeSinceLastReward >= CHAT_COOLDOWN * 2) {
                // Activity chain broken.
                userData.wallet =
                    (userData.wallet || 0) + CHAT_REWARD;

                userData.lastChatReward = now;
                userData.activityStart = now;
                userData.lastActivity = now;
                userData.chatStreak = 1;

                await setEconomyData(
                    client,
                    guildId,
                    userId,
                    userData
                );

                logger.info(
                    `[ECONOMY_CHAT] ${message.author.tag} missed an activity window. Chain reset. +${CHAT_REWARD} Souls`
                );

                return;
            }

            /*
             * Consecutive 10-minute window completed.
             */
            let newStreak = chatStreak + 1;

            let totalReward = CHAT_REWARD;
            let bonusMessage = '';

            /*
             * Six consecutive 10-minute windows = 1 hour activity.
             */
            if (newStreak >= ACTIVITY_WINDOWS_REQUIRED) {
                totalReward += ACTIVITY_BONUS;
                totalReward += STREAK_BONUS;

                bonusMessage =
                    ` +${ACTIVITY_BONUS} Activity Bonus +${STREAK_BONUS} Streak Bonus`;

                // Start a fresh activity cycle.
                newStreak = 0;
                userData.activityStart = now;
            }

            userData.wallet =
                (userData.wallet || 0) + totalReward;

            userData.lastChatReward = now;
            userData.lastActivity = now;
            userData.chatStreak = newStreak;

            await setEconomyData(
                client,
                guildId,
                userId,
                userData
            );

            logger.info(
                `[ECONOMY_CHAT] ${message.author.tag} earned ${CHAT_REWARD} Souls${bonusMessage}`
            );

        } catch (error) {
            logger.error(
                'Error handling chat economy:',
                error
            );
        }
    }
};
