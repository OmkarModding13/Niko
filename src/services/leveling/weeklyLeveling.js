// weeklyLeveling.js

import {
    getUserLevelData,
    saveUserLevelData,
    getLevelPeriod,
    getActivityRequirements,
    getActivityProgress,
    resetPeriodIfNeeded
} from './leveling.js';

/*
 * ==================================================
 * WEEKLY / MONTHLY LEVELING PROCESSOR
 * ==================================================
 *
 * LEVEL 1-49
 * ----------------
 * Weekly activity period.
 *
 * LEVEL 50+
 * ----------------
 * Monthly activity period.
 *
 * IMPORTANT:
 * Activity completion does NOT directly give a level.
 *
 * XP is earned from activity.
 * 100 XP = 1 level.
 *
 * Failed period:
 *
 * 1st consecutive failure:
 *     Current XP / 2
 *
 * 2nd consecutive failure:
 *     Current XP = 0
 *
 * Level itself NEVER decreases.
 */

/*
 * ==================================================
 * PERIOD
 * ==================================================
 */

export function getCurrentPeriod(level) {
    return getLevelPeriod(
        Number(level) || 0
    );
}

/*
 * ==================================================
 * REQUIREMENTS
 * ==================================================
 *
 * We use the requirements already defined inside
 * leveling.js so there is only one source of truth.
 */

export function getPeriodRequirements(level) {
    return getActivityRequirements(
        Number(level) || 0
    );
}

/*
 * ==================================================
 * CHECK PERIOD COMPLETION
 * ==================================================
 */

export function isPeriodComplete(userData) {
    if (!userData) {
        return false;
    }

    const progress =
        getActivityProgress(
            userData
        );

    return Boolean(
        progress.complete
    );
}

/*
 * ==================================================
 * PERIOD EXPIRY
 * ==================================================
 */

export function hasPeriodExpired(
    userData,
    now = Date.now()
) {
    if (!userData) {
        return false;
    }

    const level =
        Number(userData.level) || 0;

    const period =
        getCurrentPeriod(level);

    const date =
        new Date(now);

    /*
     * MONTHLY
     */

    if (period === 'monthly') {
        const currentMonthStart =
            new Date(
                date.getFullYear(),
                date.getMonth(),
                1,
                0,
                0,
                0,
                0
            ).getTime();

        return (
            Number(
                userData.monthStart || 0
            ) !== currentMonthStart
        );
    }

    /*
     * WEEKLY
     */

    const day =
        date.getDay();

    const diff =
        day === 0
            ? 6
            : day - 1;

    const weekStart =
        new Date(date);

    weekStart.setHours(
        0,
        0,
        0,
        0
    );

    weekStart.setDate(
        weekStart.getDate() - diff
    );

    const currentWeekStart =
        weekStart.getTime();

    return (
        Number(
            userData.weekStart || 0
        ) !== currentWeekStart
    );
}

/*
 * ==================================================
 * FAILED PERIOD DECAY
 * ==================================================
 */

export function applyFailedPeriodDecay(
    userData
) {
    if (!userData) {
        return {
            type: 'none',
            oldXp: 0,
            newXp: 0,
            failedPeriods: 0
        };
    }

    const oldXp =
        Math.max(
            0,
            Number(
                userData.xp || 0
            )
        );

    const previousFailures =
        Math.max(
            0,
            Number(
                userData.consecutiveFailedPeriods || 0
            )
        );

    /*
     * FIRST FAILED PERIOD
     *
     * 80 XP -> 40 XP
     */

    if (
        previousFailures === 0
    ) {
        userData.xp =
            Math.floor(
                oldXp / 2
            );

        userData.consecutiveFailedPeriods = 1;

        return {
            type: 'half',

            oldXp,

            newXp:
                userData.xp,

            failedPeriods: 1
        };
    }

    /*
     * SECOND CONSECUTIVE FAILURE
     *
     * XP -> 0
     *
     * Any further failed periods
     * also remain at 0 XP.
     */

    userData.xp = 0;

    userData.consecutiveFailedPeriods =
        previousFailures + 1;

    return {
        type: 'zero',

        oldXp,

        newXp: 0,

        failedPeriods:
            userData.consecutiveFailedPeriods
    };
}

/*
 * ==================================================
 * RESET PERIOD
 * ==================================================
 */

export function resetPeriodActivity(
    userData,
    period,
    now = Date.now()
) {
    if (!userData) {
        return userData;
    }

    const date =
        new Date(now);

    /*
     * MONTHLY
     */

    if (period === 'monthly') {
        userData.monthlyChatMinutes = 0;

        userData.monthlyVoiceMinutes = 0;

        userData.monthlyGames = 0;

        userData.monthStart =
            new Date(
                date.getFullYear(),
                date.getMonth(),
                1,
                0,
                0,
                0,
                0
            ).getTime();

        return userData;
    }

    /*
     * WEEKLY
     */

    const day =
        date.getDay();

    const diff =
        day === 0
            ? 6
            : day - 1;

    const weekStart =
        new Date(date);

    weekStart.setHours(
        0,
        0,
        0,
        0
    );

    weekStart.setDate(
        weekStart.getDate() - diff
    );

    userData.weekStart =
        weekStart.getTime();

    userData.weeklyChatMinutes = 0;

    userData.weeklyVoiceMinutes = 0;

    userData.weeklyGames = 0;

    return userData;
}

/*
 * ==================================================
 * PROCESS ONE USER
 * ==================================================
 *
 * This function:
 *
 * 1. Loads user data
 * 2. Determines weekly/monthly period
 * 3. Checks whether period expired
 * 4. Checks whether all activities were completed
 * 5. Applies XP decay if necessary
 * 6. Resets activity counters
 * 7. Saves everything to database
 *
 * It NEVER decreases level.
 */

export async function processUserPeriod(
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

    if (!userData) {
        return {
            processed: false,

            reason:
                'user_not_found'
        };
    }

    /*
     * Make sure old period data is normalized.
     */

    resetPeriodIfNeeded(
        userData
    );

    const level =
        Number(
            userData.level || 0
        );

    const period =
        getCurrentPeriod(
            level
        );

    /*
     * Check whether the period
     * actually ended.
     */

    if (
        !hasPeriodExpired(
            userData
        )
    ) {
        return {
            processed: false,

            reason:
                'period_not_expired',

            level,

            period,

            xp:
                Number(
                    userData.xp || 0
                )
        };
    }

    /*
     * IMPORTANT:
     *
     * Check activity BEFORE
     * resetting the counters.
     */

    const completed =
        isPeriodComplete(
            userData
        );

    let decay = null;

    /*
     * SUCCESSFUL PERIOD
     */

    if (completed) {
        userData.consecutiveFailedPeriods = 0;

        decay = {
            type: 'success',

            oldXp:
                Number(
                    userData.xp || 0
                ),

            newXp:
                Number(
                    userData.xp || 0
                ),

            failedPeriods: 0
        };
    }

    /*
     * FAILED PERIOD
     */

    else {
        decay =
            applyFailedPeriodDecay(
                userData
            );
    }

    /*
     * Reset activity for the
     * new period.
     */

    resetPeriodActivity(
        userData,
        period
    );

    /*
     * SAFETY:
     *
     * We deliberately do NOT modify
     * userData.level here.
     *
     * Therefore:
     *
     * Level 10 cannot become Level 9
     * because of activity failure.
     */

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return {
        processed: true,

        userId,

        guildId,

        level,

        period,

        completed,

        xp:
            Number(
                userData.xp || 0
            ),

        consecutiveFailedPeriods:
            Number(
                userData.consecutiveFailedPeriods || 0
            ),

        decay
    };
}

/*
 * ==================================================
 * PROCESS GUILD
 * ==================================================
 *
 * Discord guild members are used here.
 *
 * We do NOT need a separate database user-list
 * just for this processor.
 */

export async function processGuildPeriods(
    client,
    guild
) {
    if (!guild) {
        return {
            processed: 0,

            results: []
        };
    }

    const members =
        await guild.members
            .fetch()
            .catch(
                () => new Map()
            );

    const results = [];

    for (
        const [
            userId,
            member
        ]
        of members
    ) {
        /*
         * Never process bots.
         */

        if (
            member.user?.bot
        ) {
            continue;
        }

        try {
            const result =
                await processUserPeriod(
                    client,
                    guild.id,
                    userId
                );

            if (
                result.processed
            ) {
                results.push(
                    result
                );
            }
        } catch (error) {
            console.error(
                `[LEVELING] Failed to process user ${userId}:`,
                error
            );
        }
    }

    return {
        processed:
            results.length,

        results
    };
}

/*
 * ==================================================
 * PROCESS ALL GUILDS
 * ==================================================
 */

export async function processAllGuilds(
    client
) {
    const results = [];

    for (
        const [
            guildId,
            guild
        ]
        of client.guilds.cache
    ) {
        try {
            const result =
                await processGuildPeriods(
                    client,
                    guild
                );

            results.push({
                guildId,

                ...result
            });
        } catch (error) {
            console.error(
                `[LEVELING] Failed to process guild ${guildId}:`,
                error
            );
        }
    }

    return results;
}

/*
 * ==================================================
 * PERIOD PROGRESS
 * ==================================================
 */

export function getPeriodProgress(
    userData
) {
    if (!userData) {
        return null;
    }

    const progress =
        getActivityProgress(
            userData
        );

    return {
        period:
            progress.period,

        chatMinutes:
            progress.chatMinutes,

        voiceMinutes:
            progress.voiceMinutes,

        games:
            progress.games,

        chatProgress:
            progress.chatProgress,

        voiceProgress:
            progress.voiceProgress,

        gamesProgress:
            progress.gamesProgress,

        complete:
            progress.complete
    };
}

/*
 * ==================================================
 * COMPATIBILITY
 * ==================================================
 */

export function getWeeklyProgress(
    userData
) {
    return getPeriodProgress(
        userData
    );
}

export function isWeeklyComplete(
    userData
) {
    return isPeriodComplete(
        userData
    );
}

/*
 * ==================================================
 * EXPORTS
 * ==================================================
 */

export default {
    getCurrentPeriod,

    getPeriodRequirements,

    isPeriodComplete,

    hasPeriodExpired,

    resetPeriodActivity,

    applyFailedPeriodDecay,

    processUserPeriod,

    processGuildPeriods,

    processAllGuilds,

    getPeriodProgress,

    getWeeklyProgress,

    isWeeklyComplete
};
