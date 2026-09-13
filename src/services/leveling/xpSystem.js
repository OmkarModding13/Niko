// xpSystem.js

import { logger } from '../../utils/logger.js';
import {
    getUserLevelData,
    saveUserLevelData,
    addChatActivity,
    addVoiceActivity,
    addGameActivity,
    levelUpUser,
    resetWeeklyProgressIfNeeded,
    resetDailyProgressIfNeeded,
    getWeeklyProgress
} from './leveling.js';

import { Mutex } from '../../utils/mutex.js';
import { wrapServiceBoundary } from '../../utils/errorHandler.js';

/**
 * --------------------------------------------------
 * ACTIVITY XP SYSTEM
 * --------------------------------------------------
 *
 * IMPORTANT:
 * This is no longer the old "XP per message" system.
 *
 * Level progression is now based on:
 *
 * Chat  : 5 hours/day
 * Voice : 3 hours/day
 * Games : 15 games/week
 *
 * When all weekly requirements are completed,
 * the user gains +1 level.
 */

// --------------------------------------------------
// Chat Activity
// --------------------------------------------------

export const recordChatActivity = wrapServiceBoundary(
    async function recordChatActivity(
        client,
        guildId,
        userId,
        minutes
    ) {
        if (
            !Number.isFinite(minutes) ||
            minutes <= 0
        ) {
            return null;
        }

        const lockKey =
            `leveling:${guildId}:${userId}`;

        return await Mutex.runExclusive(
            lockKey,
            async () => {
                const userData =
                    await getUserLevelData(
                        client,
                        guildId,
                        userId
                    );

                resetWeeklyProgressIfNeeded(
                    userData
                );

                resetDailyProgressIfNeeded(
                    userData
                );

                const updatedData =
                    await addChatActivity(
                        client,
                        guildId,
                        userId,
                        minutes
                    );

                return {
                    userData:
                        updatedData || userData,

                    progress:
                        getWeeklyProgress(
                            updatedData || userData
                        )
                };
            }
        );
    },
    {
        service: 'xpSystem',
        operation: 'recordChatActivity',
        userMessage:
            'Failed to record chat activity.'
    }
);

// --------------------------------------------------
// Voice Activity
// --------------------------------------------------

export const recordVoiceActivity = wrapServiceBoundary(
    async function recordVoiceActivity(
        client,
        guildId,
        userId,
        minutes
    ) {
        if (
            !Number.isFinite(minutes) ||
            minutes <= 0
        ) {
            return null;
        }

        const lockKey =
            `leveling:${guildId}:${userId}`;

        return await Mutex.runExclusive(
            lockKey,
            async () => {
                const userData =
                    await getUserLevelData(
                        client,
                        guildId,
                        userId
                    );

                resetWeeklyProgressIfNeeded(
                    userData
                );

                resetDailyProgressIfNeeded(
                    userData
                );

                const updatedData =
                    await addVoiceActivity(
                        client,
                        guildId,
                        userId,
                        minutes
                    );

                return {
                    userData:
                        updatedData || userData,

                    progress:
                        getWeeklyProgress(
                            updatedData || userData
                        )
                };
            }
        );
    },
    {
        service: 'xpSystem',
        operation: 'recordVoiceActivity',
        userMessage:
            'Failed to record voice activity.'
    }
);

// --------------------------------------------------
// Game Activity
// --------------------------------------------------

export const recordGameActivity = wrapServiceBoundary(
    async function recordGameActivity(
        client,
        guildId,
        userId,
        games = 1
    ) {
        if (
            !Number.isInteger(games) ||
            games <= 0
        ) {
            return null;
        }

        const lockKey =
            `leveling:${guildId}:${userId}`;

        return await Mutex.runExclusive(
            lockKey,
            async () => {
                const userData =
                    await getUserLevelData(
                        client,
                        guildId,
                        userId
                    );

                resetWeeklyProgressIfNeeded(
                    userData
                );

                const updatedData =
                    await addGameActivity(
                        client,
                        guildId,
                        userId,
                        games
                    );

                return {
                    userData:
                        updatedData || userData,

                    progress:
                        getWeeklyProgress(
                            updatedData || userData
                        )
                };
            }
        );
    },
    {
        service: 'xpSystem',
        operation: 'recordGameActivity',
        userMessage:
            'Failed to record game activity.'
    }
);

// --------------------------------------------------
// Check Weekly Level
// --------------------------------------------------

export const checkWeeklyLevelUp =
    wrapServiceBoundary(
        async function checkWeeklyLevelUp(
            client,
            guildId,
            userId
        ) {
            const lockKey =
                `leveling:${guildId}:${userId}`;

            return await Mutex.runExclusive(
                lockKey,
                async () => {
                    const userData =
                        await getUserLevelData(
                            client,
                            guildId,
                            userId
                        );

                    resetWeeklyProgressIfNeeded(
                        userData
                    );

                    resetDailyProgressIfNeeded(
                        userData
                    );

                    const progress =
                        getWeeklyProgress(
                            userData
                        );

                    // Requirements not completed
                    if (!progress.complete) {
                        return {
                            leveledUp: false,
                            progress,
                            userData
                        };
                    }

                    const result =
                        await levelUpUser(
                            client,
                            guildId,
                            userId
                        );

                    logger.info(
                        `🎉 Weekly leveling completed for ${userId} in ${guildId}`
                    );

                    return {
                        ...result,
                        progress:
                            getWeeklyProgress(
                                result.userData
                            )
                    };
                }
            );
        },
        {
            service: 'xpSystem',
            operation: 'checkWeeklyLevelUp',
            userMessage:
                'Failed to check weekly level progress.'
        }
    );

// --------------------------------------------------
// Generic Activity Recorder
// --------------------------------------------------

export async function recordActivity(
    client,
    guildId,
    userId,
    type,
    amount = 1
) {
    switch (type) {
        case 'chat':
            return await recordChatActivity(
                client,
                guildId,
                userId,
                amount
            );

        case 'voice':
            return await recordVoiceActivity(
                client,
                guildId,
                userId,
                amount
            );

        case 'game':
            return await recordGameActivity(
                client,
                guildId,
                userId,
                amount
            );

        default:
            logger.warn(
                `Unknown leveling activity type: ${type}`
            );

            return null;
    }
}

// --------------------------------------------------
// Get User Progress
// --------------------------------------------------

export async function getActivityProgress(
    client,
    guildId,
    userId
) {
    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    resetWeeklyProgressIfNeeded(
        userData
    );

    resetDailyProgressIfNeeded(
        userData
    );

    return {
        level:
            userData.level,

        xp:
            userData.xp,

        totalXp:
            userData.totalXp,

        weekly:
            getWeeklyProgress(
                userData
            ),

        daily: {
            chatMinutes:
                userData.dailyChatMinutes,

            voiceMinutes:
                userData.dailyVoiceMinutes
        }
    };
}

// --------------------------------------------------
// Legacy Compatibility
// --------------------------------------------------

/**
 * Kept so older files importing addXp()
 * don't immediately crash.
 *
 * IMPORTANT:
 * This no longer gives XP for every message.
 *
 * Instead, callers should migrate to:
 *
 * recordChatActivity()
 * recordVoiceActivity()
 * recordGameActivity()
 */

export const addXp = wrapServiceBoundary(
    async function addXp(
        client,
        guild,
        member,
        xpToAdd
    ) {
        if (
            !guild ||
            !member
        ) {
            return null;
        }

        /*
         * Legacy message XP is intentionally disabled.
         *
         * We do NOT convert arbitrary XP into levels because
         * the new leveling system is activity based.
         */

        logger.debug(
            `Legacy addXp() ignored for ${member.user.id}. ` +
            `Use activity tracking instead.`
        );

        const userData =
            await getUserLevelData(
                client,
                guild.id,
                member.user.id
            );

        return {
            level:
                userData.level,

            xp:
                userData.xp,

            totalXp:
                userData.totalXp,

            xpNeeded:
                0,

            leveledUp:
                false
        };
    },
    {
        service: 'xpSystem',
        operation: 'addXp',
        userMessage:
            'Failed to process leveling activity.'
    }
);

// --------------------------------------------------
// Manual Activity Helpers
// --------------------------------------------------

export async function addChatMinutes(
    client,
    guildId,
    userId,
    minutes
) {
    const result =
        await recordChatActivity(
            client,
            guildId,
            userId,
            minutes
        );

    await checkWeeklyLevelUp(
        client,
        guildId,
        userId
    );

    return result;
}

export async function addVoiceMinutes(
    client,
    guildId,
    userId,
    minutes
) {
    const result =
        await recordVoiceActivity(
            client,
            guildId,
            userId,
            minutes
        );

    await checkWeeklyLevelUp(
        client,
        guildId,
        userId
    );

    return result;
}

export async function addGames(
    client,
    guildId,
    userId,
    games = 1
) {
    const result =
        await recordGameActivity(
            client,
            guildId,
            userId,
            games
        );

    await checkWeeklyLevelUp(
        client,
        guildId,
        userId
    );

    return result;
}
