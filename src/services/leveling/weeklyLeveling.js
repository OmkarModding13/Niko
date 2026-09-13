// weeklyLeveling.js

import {
    getUserLevelData,
    saveUserLevelData,
    getLevelPeriod,
    getActivityRequirements,
    getActivityProgress
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
 * XP is earned through activity.
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
 * PERIOD START HELPERS
 * ==================================================
 */

function getWeekStart(
    timestamp = Date.now()
) {
    const date =
        new Date(timestamp);

    const day =
        date.getDay();

    const diff =
        day === 0
            ? 6
            : day - 1;

    date.setHours(
        0,
        0,
        0,
        0
    );

    date.setDate(
        date.getDate() - diff
    );

    return date.getTime();
}

function getMonthStart(
    timestamp = Date.now()
) {
    const date =
        new Date(timestamp);

    date.setDate(1);

    date.setHours(
        0,
        0,
        0,
        0
    );

    return date.getTime();
}

/*
 * ==================================================
 * PERIOD EXPIRY
 * ==================================================
 *
 * IMPORTANT:
 * This function checks whether the OLD period
 * has ended BEFORE anything is reset.
 */

export function hasPeriodExpired(
    userData,
    now = Date.now()
) {
    if (!userData) {
        return false;
    }

    const level =
        Number(
            userData.level || 0
        );

    const period =
        getCurrentPeriod(
            level
        );

    /*
     * MONTHLY
     */

    if (period === 'monthly') {
        const currentMonthStart =
            getMonthStart(
                now
            );

        const storedMonthStart =
            Number(
                userData.monthStart || 0
            );

        /*
         * New users / missing timestamp
         * are NOT considered expired here.
         *
         * Their activity system will initialize
         * normally on first activity.
         */

        if (!storedMonthStart) {
            return false;
        }

        return (
            storedMonthStart !==
            currentMonthStart
        );
    }

    /*
     * WEEKLY
     */

    const currentWeekStart =
        getWeekStart(
            now
        );

    const storedWeekStart =
        Number(
            userData.weekStart || 0
        );

    if (!storedWeekStart) {
        return false;
    }

    return (
        storedWeekStart !==
        currentWeekStart
    );
}

/*
 * ==================================================
 * RESET PERIOD ACTIVITY
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

    if (period === 'monthly') {
        userData.monthlyChatMinutes = 0;

        userData.monthlyVoiceMinutes = 0;

        userData.monthlyGames = 0;

        userData.monthStart =
            getMonthStart(
                now
            );

        return userData;
    }

    /*
     * WEEKLY
     */

    userData.weeklyChatMinutes = 0;

    userData.weeklyVoiceMinutes = 0;

    userData.weeklyGames = 0;

    userData.weekStart =
        getWeekStart(
            now
        );

    return userData;
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
     * FIRST CONSECUTIVE FAILURE
     *
     * Example:
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

        userData.consecutiveFailedPeriods =
            1;

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
     * Example:
     *
     * 40 XP -> 0 XP
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
 * PROCESS ONE USER
 * ==================================================
 *
 * IMPORTANT:
 *
 * We check expiry FIRST.
 *
 * We do NOT call resetPeriodIfNeeded()
 * before checking expiry because that would
 * erase the old period's activity before
 * we evaluate it.
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

    const level =
        Number(
            userData.level || 0
        );

    const period =
        getCurrentPeriod(
            level
        );

    /*
     * Check whether the period ended.
     */

    const expired =
        hasPeriodExpired(
            userData
        );

    if (!expired) {
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
     * ==================================================
     * OLD PERIOD ACTIVITY CHECK
     * ==================================================
     *
     * We MUST do this before resetting counters.
     */

    const completed =
        isPeriodComplete(
            userData
        );

    let decay;

    /*
     * ==================================================
     * SUCCESS
     * ==================================================
     */

    if (completed) {
        /*
         * Successful period.
         *
         * No XP bonus here.
         * XP comes from actual activity.
         *
         * Reset failed-period streak.
         */

        const currentXp =
            Number(
                userData.xp || 0
            );

        userData.consecutiveFailedPeriods =
            0;

        decay = {
            type: 'success',

            oldXp:
                currentXp,

            newXp:
                currentXp,

            failedPeriods: 0
        };
    }

    /*
     * ==================================================
     * FAILURE
     * ==================================================
     */

    else {
        decay =
            applyFailedPeriodDecay(
                userData
            );
    }

    /*
     * ==================================================
     * RESET FOR NEW PERIOD
     * ==================================================
     */

    resetPeriodActivity(
        userData,
        period
    );

    /*
     * ==================================================
     * LEVEL PROTECTION
     * ==================================================
     *
     * DO NOT TOUCH userData.level.
     *
     * Failed activity can NEVER reduce
     * someone's level.
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
 * PROCESS ONE GUILD
 * ==================================================
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
 * DEFAULT EXPORT
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
