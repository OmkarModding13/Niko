import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import {
    getEconomyData,
    setEconomyData
} from '../utils/economy.js';

const CHAT_REWARD = 2;
const CHAT_COOLDOWN = 1 * 60 * 1000; // 10 minutes

// Activity system
const ACTIVITY_WINDOWS_REQUIRED = 6;
const ACTIVITY_BONUS = 20;
const STREAK_BONUS = 10;

// If the user disappears for more than 20 minutes,
// their consecutive activity streak resets.
const ACTIVITY_RESET_TIME = 20 * 60 * 1000;

// Temporary anti-spam tracking
const recentMessages = new Map();

export default {
    name: Events.MessageCreate,

    async execute(message, client) {
        try {
            if (message.author.bot || !message.guild) {
                return;
            }

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

            if (!userData) {
                return;
            }

            const lastReward = userData.lastChatReward || 0;

            // 10-minute chat reward cooldown
            if (now - lastReward < CHAT_COOLDOWN) {
                return;
            }

            /*
             * ----------------------------------------
             * CHAT REWARD
             * ----------------------------------------
             */

            userData.wallet = (userData.wallet || 0) + CHAT_REWARD;
            userData.lastChatReward = now;

            /*
             * ----------------------------------------
             * ACTIVITY / STREAK SYSTEM
             * ----------------------------------------
             */

            const lastActivity = userData.lastActivity || 0;
            let chatStreak = userData.chatStreak || 0;

            // If this is the first qualifying activity
            // or the user was inactive for too long,
            // start a new streak.
            if (
                !lastActivity ||
                now - lastActivity > ACTIVITY_RESET_TIME
            ) {
                chatStreak = 1;
                userData.activityStart = now;
            } else {
                // Consecutive qualifying activity
                chatStreak += 1;
            }

            userData.lastActivity = now;
            userData.chatStreak = chatStreak;

            /*
             * ----------------------------------------
             * 1-HOUR ACTIVITY BONUS
             * ----------------------------------------
             *
             * 6 qualifying 10-minute windows
             * = approximately 1 hour of activity.
             */

            if (chatStreak >= ACTIVITY_WINDOWS_REQUIRED) {
                userData.wallet =
                    (userData.wallet || 0) +
                    ACTIVITY_BONUS +
                    STREAK_BONUS;

                logger.info(
                    `[ECONOMY_ACTIVITY] ${message.author.tag} completed 1 hour activity and earned ${ACTIVITY_BONUS + STREAK_BONUS} bonus Souls`
                );

                // Start a new 1-hour activity cycle.
                userData.chatStreak = 0;
                userData.activityStart = now;
            }

            /*
             * ----------------------------------------
             * SAVE EVERYTHING ONCE
             * ----------------------------------------
             */

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
