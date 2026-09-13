// xpSystem.js

import { logger } from '../../utils/logger.js';

import {
    getUserLevelData,
    saveUserLevelData,
    addChatActivity,
    addVoiceActivity,
    addGameActivity,
    resetWeeklyProgressIfNeeded,
    resetDailyProgressIfNeeded,
    getWeeklyProgress,
    addLevelXp,
    getLevelPeriod
} from './leveling.js';

import { Mutex } from '../../utils/mutex.js';

import {
    wrapServiceBoundary
} from '../../utils/errorHandler.js';


/*
 * ==================================================
 * ACTIVITY XP SETTINGS
 * ==================================================
 *
 * IMPORTANT:
 *
 * Activity requirements and XP progression are
 * separate systems.
 *
 * 100 XP = 1 level.
 *
 * Completing the weekly/monthly activity target
 * does NOT directly give +1 level.
 *
 * Activity earns XP.
 *
 * --------------------------------------------------
 *
 * Current XP conversion:
 *
 * Chat  : 1 XP / 10 active minutes
 * Voice : 1 XP / 15 voice minutes
 * Game  : 5 XP / completed game
 *
 * These values are kept here so they can easily
 * be changed later.
 */

export const ACTIVITY_XP = {
    chatMinutes: 10,
    voiceMinutes: 15,
    xpPerGame: 5
};


/*
 * ==================================================
 * CHAT ACTIVITY
 * ==================================================
 */

export const recordChatActivity =
    wrapServiceBoundary(
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

                    /*
                     * Make sure period/daily data
                     * is up to date before adding activity.
                     */
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

                    /*
                     * Record activity.
                     */
                    const updatedData =
                        await addChatActivity(
                            client,
                            guildId,
                            userId,
                            minutes
                        );

                    const finalData =
                        updatedData ||
                        userData;

                    /*
                     * Convert active chat time into XP.
                     *
                     * Example:
                     * 20 minutes = 2 XP
                     */
                    const xp =
                        Math.floor(
                            minutes /
                            ACTIVITY_XP.chatMinutes
                        );

                    let xpResult = null;

                    if (xp > 0) {
                        xpResult =
                            await addLevelXp(
                                client,
                                guildId,
                                userId,
                                xp
                            );
                    }

                    return {
                        userData:
                            xpResult
                                ? await getUserLevelData(
                                    client,
                                    guildId,
                                    userId
                                )
                                : finalData,

                        progress:
                            getWeeklyProgress(
                                xpResult
                                    ? await getUserLevelData(
                                        client,
                                        guildId,
                                        userId
                                    )
                                    : finalData
                            ),

                        xpEarned:
                            xp,

                        leveledUp:
                            Boolean(
                                xpResult?.leveledUp
                            ),

                        level:
                            xpResult?.level ??
                            finalData.level,

                        currentXp:
                            xpResult?.xp ??
                            finalData.xp
                    };
                }
            );
        },
        {
            service:
                'xpSystem',

            operation:
                'recordChatActivity',

            userMessage:
                'Failed to record chat activity.'
        }
    );


/*
 * ==================================================
 * VOICE ACTIVITY
 * ==================================================
 */

export const recordVoiceActivity =
    wrapServiceBoundary(
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

                    /*
                     * Record voice activity.
                     */
                    const updatedData =
                        await addVoiceActivity(
                            client,
                            guildId,
                            userId,
                            minutes
                        );

                    const finalData =
                        updatedData ||
                        userData;

                    /*
                     * Convert voice time into XP.
                     *
                     * Example:
                     * 30 minutes = 2 XP
                     */
                    const xp =
                        Math.floor(
                            minutes /
                            ACTIVITY_XP.voiceMinutes
                        );

                    let xpResult = null;

                    if (xp > 0) {
                        xpResult =
                            await addLevelXp(
                                client,
                                guildId,
                                userId,
                                xp
                            );
                    }

                    const latestData =
                        xpResult
                            ? await getUserLevelData(
                                client,
                                guildId,
                                userId
                            )
                            : finalData;

                    return {
                        userData:
                            latestData,

                        progress:
                            getWeeklyProgress(
                                latestData
                            ),

                        xpEarned:
                            xp,

                        leveledUp:
                            Boolean(
                                xpResult?.leveledUp
                            ),

                        level:
                            latestData.level,

                        currentXp:
                            latestData.xp
                    };
                }
            );
        },
        {
            service:
                'xpSystem',

            operation:
                'recordVoiceActivity',

            userMessage:
                'Failed to record voice activity.'
        }
    );


/*
 * ==================================================
 * GAME ACTIVITY
 * ==================================================
 */

export const recordGameActivity =
    wrapServiceBoundary(
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

                    /*
                     * Record completed games.
                     */
                    const updatedData =
                        await addGameActivity(
                            client,
                            guildId,
                            userId,
                            games
                        );

                    const finalData =
                        updatedData ||
                        userData;

                    /*
                     * Games give XP directly.
                     */
                    const xp =
                        games *
                        ACTIVITY_XP.xpPerGame;

                    const xpResult =
                        await addLevelXp(
                            client,
                            guildId,
                            userId,
                            xp
                        );

                    const latestData =
                        await getUserLevelData(
                            client,
                            guildId,
                            userId
                        );

                    return {
                        userData:
                            latestData,

                        progress:
                            getWeeklyProgress(
                                latestData
                            ),

                        xpEarned:
                            xp,

                        gamesCompleted:
                            games,

                        leveledUp:
                            Boolean(
                                xpResult?.leveledUp
                            ),

                        level:
                            latestData.level,

                        currentXp:
                            latestData.xp
                    };
                }
            );
        },
        {
            service:
                'xpSystem',

            operation:
                'recordGameActivity',

            userMessage:
                'Failed to record game activity.'
        }
    );


/*
 * ==================================================
 * CHECK ACTIVITY PERIOD
 * ==================================================
 *
 * IMPORTANT:
 *
 * This function does NOT level up a user.
 *
 * It only checks whether the current
 * weekly/monthly requirements are complete.
 *
 * Leveling happens through 100 XP.
 */

export const checkActivityPeriod =
    wrapServiceBoundary(
        async function checkActivityPeriod(
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

                    const period =
                        getLevelPeriod(
                            userData.level
                        );

                    return {
                        leveledUp:
                            false,

                        period,

                        complete:
                            progress.complete,

                        progress,

                        userData
                    };
                }
            );
        },
        {
            service:
                'xpSystem',

            operation:
                'checkActivityPeriod',

            userMessage:
                'Failed to check activity progress.'
        }
    );


/*
 * ==================================================
 * OLD FUNCTION COMPATIBILITY
 * ==================================================
 *
 * Some existing files may still call:
 *
 * checkWeeklyLevelUp()
 *
 * Keep the function so those files don't crash.
 *
 * BUT:
 *
 * It no longer gives +1 level.
 */

export const checkWeeklyLevelUp =
    wrapServiceBoundary(
        async function checkWeeklyLevelUp(
            client,
            guildId,
            userId
        ) {
            return await checkActivityPeriod(
                client,
                guildId,
                userId
            );
        },
        {
            service:
                'xpSystem',

            operation:
                'checkWeeklyLevelUp',

            userMessage:
                'Failed to check activity period.'
        }
    );


/*
 * ==================================================
 * GENERIC ACTIVITY RECORDER
 * ==================================================
 */

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


/*
 * ==================================================
 * GET USER PROGRESS
 * ==================================================
 */

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

    const progress =
        getWeeklyProgress(
            userData
        );

    const period =
        getLevelPeriod(
            userData.level
        );

    return {
        level:
            userData.level,

        xp:
            userData.xp,

        xpNeeded:
            100,

        totalXp:
            userData.totalXp,

        period,

        weekly:
            progress,

        daily: {
            chatMinutes:
                userData.dailyChatMinutes,

            voiceMinutes:
                userData.dailyVoiceMinutes
        }
    };
}


/*
 * ==================================================
 * LEGACY addXp()
 * ==================================================
 *
 * Old messageCreate.js may still call addXp().
 *
 * We intentionally keep it.
 *
 * It now adds XP through the new fixed
 * 100 XP = 1 level system.
 *
 * However, messageCreate should eventually
 * be changed so it records ACTIVE chat
 * instead of random XP per message.
 */

export const addXp =
    wrapServiceBoundary(
        async function addXp(
            client,
            guild,
            member,
            xpToAdd
        ) {
            if (
                !guild ||
                !member ||
                !Number.isFinite(
                    xpToAdd
                ) ||
                xpToAdd <= 0
            ) {
                return null;
            }

            const lockKey =
                `leveling:${guild.id}:${member.user.id}`;

            return await Mutex.runExclusive(
                lockKey,
                async () => {

                    const result =
                        await addLevelXp(
                            client,
                            guild.id,
                            member.user.id,
                            xpToAdd
                        );

                    if (!result) {
                        return null;
                    }

                    /*
                     * Level NEVER decreases
                     * automatically.
                     */
                    return {
                        level:
                            result.level,

                        xp:
                            result.xp,

                        totalXp:
                            result.totalXp,

                        xpNeeded:
                            100,

                        leveledUp:
                            result.leveledUp,

                        levelsGained:
                            result.levelsGained
                    };
                }
            );
        },
        {
            service:
                'xpSystem',

            operation:
                'addXp',

            userMessage:
                'Failed to process XP.'
        }
    );


/*
 * ==================================================
 * MANUAL ACTIVITY HELPERS
 * ==================================================
 */

export async function addChatMinutes(
    client,
    guildId,
    userId,
    minutes
) {
    return await recordChatActivity(
        client,
        guildId,
        userId,
        minutes
    );
}


export async function addVoiceMinutes(
    client,
    guildId,
    userId,
    minutes
) {
    return await recordVoiceActivity(
        client,
        guildId,
        userId,
        minutes
    );
}


export async function addGames(
    client,
    guildId,
    userId,
    games = 1
) {
    return await recordGameActivity(
        client,
        guildId,
        userId,
        games
    );
}
