const {
    getUserLevelData,
    saveUserLevelData,
    getLevelPeriod,
    getXpForLevel,
} = require("./leveling");

/**
 * Weekly / Monthly Leveling Processor
 *
 * Rules:
 * - Level 1–49 → Weekly requirements
 * - Level 50 → Monthly system starts
 * - Level 50 → 51 requires completing the monthly period
 * - Level never decreases
 * - Failed period #1 → current XP halves
 * - Failed period #2 → current XP becomes 0
 * - Successful period → XP stays untouched
 *
 * IMPORTANT:
 * This file does NOT directly level up users.
 * XP reaches 100 through activity XP.
 */

const WEEKLY_REQUIREMENTS = {
    voiceMinutes: 21 * 60, // 21 hours
    chatMinutes: 35 * 60,  // 35 hours
    games: 15,
};

const MONTHLY_REQUIREMENTS = {
    // Monthly values are configurable.
    // These are intentionally kept separate so they can
    // be changed later without touching the core leveling system.
    voiceMinutes: 180 * 60,
    chatMinutes: 300 * 60,
    games: 60,
};

/**
 * Get the current activity period for a user.
 *
 * IMPORTANT:
 * Level 50 starts the monthly progression system.
 */
function getCurrentPeriod(level) {
    return level >= 50 ? "monthly" : "weekly";
}

/**
 * Get period requirements.
 */
function getPeriodRequirements(level) {
    const period = getCurrentPeriod(level);

    if (period === "monthly") {
        return MONTHLY_REQUIREMENTS;
    }

    return WEEKLY_REQUIREMENTS;
}

/**
 * Check whether all requirements are completed.
 */
function isPeriodComplete(data) {
    const level = Number(data.level || 0);
    const period = getCurrentPeriod(level);
    const requirements = getPeriodRequirements(level);

    if (period === "monthly") {
        return (
            Number(data.monthlyVoiceMinutes || 0) >= requirements.voiceMinutes &&
            Number(data.monthlyChatMinutes || 0) >= requirements.chatMinutes &&
            Number(data.monthlyGames || 0) >= requirements.games
        );
    }

    return (
        Number(data.weeklyVoiceMinutes || 0) >= requirements.voiceMinutes &&
        Number(data.weeklyChatMinutes || 0) >= requirements.chatMinutes &&
        Number(data.weeklyGames || 0) >= requirements.games
    );
}

/**
 * Get period start timestamp.
 */
function getPeriodStart(data, period) {
    if (period === "monthly") {
        return Number(data.monthStart || 0);
    }

    return Number(data.weekStart || 0);
}

/**
 * Create a new period start timestamp.
 */
function createPeriodStart(period) {
    const now = new Date();

    if (period === "monthly") {
        return new Date(
            now.getFullYear(),
            now.getMonth(),
            1
        ).getTime();
    }

    // Monday = start of week
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;

    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - diff);

    return monday.getTime();
}

/**
 * Check if current period has expired.
 */
function hasPeriodExpired(data, period) {
    const periodStart = getPeriodStart(data, period);

    if (!periodStart) {
        return true;
    }

    const now = new Date();
    const start = new Date(periodStart);

    if (period === "monthly") {
        return (
            now.getFullYear() !== start.getFullYear() ||
            now.getMonth() !== start.getMonth()
        );
    }

    const currentStart = createPeriodStart("weekly");

    return currentStart !== periodStart;
}

/**
 * Reset activity counters for a new period.
 */
function resetPeriodActivity(data, period) {
    if (period === "monthly") {
        data.monthlyVoiceMinutes = 0;
        data.monthlyChatMinutes = 0;
        data.monthlyGames = 0;
        data.monthStart = createPeriodStart("monthly");
    } else {
        data.weeklyVoiceMinutes = 0;
        data.weeklyChatMinutes = 0;
        data.weeklyGames = 0;
        data.weekStart = createPeriodStart("weekly");
    }

    return data;
}

/**
 * Apply failed-period decay.
 *
 * First consecutive failure:
 *     80 XP → 40 XP
 *
 * Second consecutive failure:
 *     40 XP → 0 XP
 *
 * Third successful period:
 *     failure streak resets.
 *
 * Level is NEVER decreased.
 */
function applyFailedPeriodDecay(data) {
    const currentXp = Math.max(0, Number(data.xp || 0));
    const failedPeriods = Number(data.consecutiveFailedPeriods || 0);

    if (failedPeriods <= 0) {
        data.xp = Math.floor(currentXp / 2);
        data.consecutiveFailedPeriods = 1;

        return {
            type: "half",
            oldXp: currentXp,
            newXp: data.xp,
        };
    }

    data.xp = 0;
    data.consecutiveFailedPeriods = failedPeriods + 1;

    return {
        type: "zero",
        oldXp: currentXp,
        newXp: 0,
    };
}

/**
 * Process one user's expired activity period.
 *
 * This is the main function the cron job will use later.
 */
async function processUserPeriod(userId) {
    const data = await getUserLevelData(userId);

    if (!data) {
        return {
            processed: false,
            reason: "user_not_found",
        };
    }

    const level = Number(data.level || 0);
    const period = getCurrentPeriod(level);

    if (!hasPeriodExpired(data, period)) {
        return {
            processed: false,
            reason: "period_not_expired",
            period,
        };
    }

    const completed = isPeriodComplete(data);

    let result;

    if (completed) {
        // Successful period.
        data.consecutiveFailedPeriods = 0;

        result = {
            type: "success",
            xp: Number(data.xp || 0),
        };
    } else {
        // Failed period.
        result = applyFailedPeriodDecay(data);
    }

    resetPeriodActivity(data, period);

    await saveUserLevelData(userId, data);

    return {
        processed: true,
        userId,
        level,
        period,
        completed,
        ...result,
    };
}

/**
 * Process period for multiple users.
 *
 * Later app.js cron can call this with all leveling users.
 */
async function processAllUsers(userIds = []) {
    const results = [];

    for (const userId of userIds) {
        try {
            const result = await processUserPeriod(userId);
            results.push(result);
        } catch (error) {
            console.error(
                `[LEVELING] Failed to process user ${userId}:`,
                error
            );

            results.push({
                processed: false,
                userId,
                reason: "error",
                error: error.message,
            });
        }
    }

    return results;
}

/**
 * Get readable progress information.
 */
function getPeriodProgress(data) {
    const level = Number(data.level || 0);
    const period = getCurrentPeriod(level);
    const requirements = getPeriodRequirements(level);

    if (period === "monthly") {
        return {
            period: "monthly",

            voice: {
                current: Number(data.monthlyVoiceMinutes || 0),
                required: requirements.voiceMinutes,
                completed:
                    Number(data.monthlyVoiceMinutes || 0) >=
                    requirements.voiceMinutes,
            },

            chat: {
                current: Number(data.monthlyChatMinutes || 0),
                required: requirements.chatMinutes,
                completed:
                    Number(data.monthlyChatMinutes || 0) >=
                    requirements.chatMinutes,
            },

            games: {
                current: Number(data.monthlyGames || 0),
                required: requirements.games,
                completed:
                    Number(data.monthlyGames || 0) >=
                    requirements.games,
            },

            complete: isPeriodComplete(data),
        };
    }

    return {
        period: "weekly",

        voice: {
            current: Number(data.weeklyVoiceMinutes || 0),
            required: requirements.voiceMinutes,
            completed:
                Number(data.weeklyVoiceMinutes || 0) >=
                requirements.voiceMinutes,
        },

        chat: {
            current: Number(data.weeklyChatMinutes || 0),
            required: requirements.chatMinutes,
            completed:
                Number(data.weeklyChatMinutes || 0) >=
                requirements.chatMinutes,
        },

        games: {
            current: Number(data.weeklyGames || 0),
            required: requirements.games,
            completed:
                Number(data.weeklyGames || 0) >=
                requirements.games,
        },

        complete: isPeriodComplete(data),
    };
}

module.exports = {
    WEEKLY_REQUIREMENTS,
    MONTHLY_REQUIREMENTS,

    getCurrentPeriod,
    getPeriodRequirements,
    isPeriodComplete,

    hasPeriodExpired,
    resetPeriodActivity,

    applyFailedPeriodDecay,

    processUserPeriod,
    processAllUsers,

    getPeriodProgress,
};
