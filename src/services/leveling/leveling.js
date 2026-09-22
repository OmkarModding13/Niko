// leveling.js

import { EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { handleLevelUpRewards } from './milestoneRewards.js';
import {
    getGuildConfig,
    setGuildConfig
} from '../config/guildConfig.js';
import {
    TitanBotError,
    ErrorTypes
} from '../../utils/errorHandler.js';
import {
    getUserLevelKey
} from '../../utils/database/keys.js';

const MAX_LEVEL = 1000;
const MIN_LEVEL = 0;

export const XP_PER_LEVEL = 100;
export const MONTHLY_LEVEL_START = 50;

/*
 * ==================================================
 * ACTIVITY REQUIREMENTS
 * ==================================================
 *
 * LEVEL 1-49
 * ----------------
 * Chat  : 5 hours/day
 * Voice : 3 hours/day
 * Games : 15/week
 *
 * LEVEL 50+
 * ----------------
 * Monthly progression.
 */

export const LEVELING_REQUIREMENTS = {
    weekly: {
        chatMinutesPerDay: 300,
        voiceMinutesPerDay: 180,
        gamesPerWeek: 15,

        chatMinutesPerWeek: 300 * 7,
        voiceMinutesPerWeek: 180 * 7
    },

    monthly: {
        chatMinutesPerDay: 300,
        voiceMinutesPerDay: 180,
        gamesPerMonth: 60
    }
};

/*
 * ==================================================
 * MILESTONE REWARDS
 * ==================================================
 *
 * Reward = Level x 100 Souls
 */

export const LEVEL_MILESTONES = {
    5: {
        roleName: 'Lost Soul',
        souls: 500
    },

    10: {
        roleName: 'Shadow Walker',
        souls: 1000
    },

    20: {
        roleName: 'Devil Disciple',
        souls: 2000
    },

    30: {
        roleName: 'Abyss Hunter',
        souls: 3000
    },

    40: {
        roleName: 'Hellborn',
        souls: 4000
    },

    50: {
        roleName: 'Void Reaper',
        souls: 5000
    },

    75: {
        roleName: 'Hollow Lord',
        souls: 7500
    },

    100: {
        roleName: 'Hollow Legend',
        souls: 10000
    }
};

/*
 * ==================================================
 * XP
 * ==================================================
 */

export function getXpForLevel(level) {
    if (
        !Number.isInteger(level) ||
        level < MIN_LEVEL ||
        level > MAX_LEVEL
    ) {
        throw new TitanBotError(
            `Invalid level: ${level}`,
            ErrorTypes.VALIDATION,
            `Level must be between ${MIN_LEVEL} and ${MAX_LEVEL}.`
        );
    }

    return XP_PER_LEVEL;
}

export function getLevelFromXp(xp) {
    if (
        !Number.isFinite(xp) ||
        xp < 0
    ) {
        throw new TitanBotError(
            `Invalid XP: ${xp}`,
            ErrorTypes.VALIDATION,
            'XP must be a non-negative number.'
        );
    }

    const safeXp =
        Math.floor(xp);

    const levelGain =
        Math.floor(
            safeXp / XP_PER_LEVEL
        );

    const level =
        Math.min(
            MAX_LEVEL,
            levelGain
        );

    const currentXp =
        level >= MAX_LEVEL
            ? 0
            : safeXp % XP_PER_LEVEL;

    return {
        level,
        currentXp,
        xpNeeded: XP_PER_LEVEL
    };
}

export function calculateTotalXp(
    level,
    currentXp = 0
) {
    const safeLevel =
        Math.max(
            MIN_LEVEL,
            Math.min(
                MAX_LEVEL,
                Number(level) || 0
            )
        );

    const safeXp =
        Math.max(
            0,
            Number(currentXp) || 0
        );

    return (
        safeLevel * XP_PER_LEVEL +
        safeXp
    );
}

/*
 * ==================================================
 * LEVELING CONFIG
 * ==================================================
 */

export async function getLevelingConfig(
    client,
    guildId
) {
    try {
        const guildConfig =
            await getGuildConfig(
                client,
                guildId
            );

        return guildConfig.leveling || {
            enabled: true,

            weekly: {
                chatMinutesPerDay:
                    LEVELING_REQUIREMENTS.weekly
                        .chatMinutesPerDay,

                voiceMinutesPerDay:
                    LEVELING_REQUIREMENTS.weekly
                        .voiceMinutesPerDay,

                gamesPerWeek:
                    LEVELING_REQUIREMENTS.weekly
                        .gamesPerWeek
            },

            monthly: {
                chatMinutesPerDay:
                    LEVELING_REQUIREMENTS.monthly
                        .chatMinutesPerDay,

                voiceMinutesPerDay:
                    LEVELING_REQUIREMENTS.monthly
                        .voiceMinutesPerDay,

                gamesPerMonth:
                    LEVELING_REQUIREMENTS.monthly
                        .gamesPerMonth
            },

            levelUpMessage:
                '{user} has reached level {level}!',

            levelUpChannel: null,

            ignoredChannels: [],

            ignoredRoles: [],

            blacklistedUsers: [],

            roleRewards: {},

            announceLevelUp: true,

            xpMultiplier: 1
        };
    } catch (error) {
        logger.error(
            `Error getting leveling config for guild ${guildId}:`,
            error
        );

        return {
            enabled: true,

            weekly: {
                ...LEVELING_REQUIREMENTS.weekly
            },

            monthly: {
                ...LEVELING_REQUIREMENTS.monthly
            },

            levelUpMessage:
                '{user} has reached level {level}!',

            levelUpChannel: null,

            ignoredChannels: [],

            ignoredRoles: [],

            blacklistedUsers: [],

            roleRewards: {},

            announceLevelUp: true,

            xpMultiplier: 1
        };
    }
}

export async function saveLevelingConfig(
    client,
    guildId,
    config
) {
    try {
        if (
            !guildId ||
            !config
        ) {
            throw new TitanBotError(
                'Guild ID and config are required',
                ErrorTypes.VALIDATION
            );
        }

        const guildConfig =
            await getGuildConfig(
                client,
                guildId
            );

        guildConfig.leveling =
            config;

        await setGuildConfig(
            client,
            guildId,
            guildConfig
        );

        logger.info(
            `Leveling config updated for guild ${guildId}`
        );

        return true;
    } catch (error) {
        logger.error(
            `Error saving leveling config for guild ${guildId}:`,
            error
        );

        if (
            error instanceof TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to save config: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not save leveling configuration.'
        );
    }
}

/*
 * ==================================================
 * USER LEVEL DATA
 * ==================================================
 */

export async function getUserLevelData(
    client,
    guildId,
    userId
) {
    try {
        if (
            !guildId ||
            !userId
        ) {
            throw new TitanBotError(
                'Guild ID and User ID are required',
                ErrorTypes.VALIDATION
            );
        }

        const key =
            getUserLevelKey(
                guildId,
                userId
            );

        const data =
            await client.db.get(
                key
            );

        if (!data) {
            return createDefaultLevelData();
        }

        return normalizeLevelData(
            data
        );
    } catch (error) {
        logger.error(
            `Error getting level data for ${userId}:`,
            error
        );

        if (
            error instanceof TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to fetch user level data: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not load level data.'
        );
    }
}

export async function saveUserLevelData(
    client,
    guildId,
    userId,
    data
) {
    try {
        if (
            !guildId ||
            !userId
        ) {
            throw new TitanBotError(
                'Guild ID and User ID are required',
                ErrorTypes.VALIDATION
            );
        }

        if (
            !data ||
            typeof data !== 'object'
        ) {
            throw new TitanBotError(
                'Invalid user level data',
                ErrorTypes.VALIDATION
            );
        }

        const sanitizedData =
            normalizeLevelData(
                data
            );

        sanitizedData.updatedAt =
            Date.now();

        const key =
            getUserLevelKey(
                guildId,
                userId
            );

        await client.db.set(
            key,
            sanitizedData
        );

        return sanitizedData;
    } catch (error) {
        logger.error(
            `Error saving level data for ${userId}:`,
            error
        );

        if (
            error instanceof TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to save user level data: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not save level data.'
        );
    }
}

/*
 * ==================================================
 * DEFAULT DATA
 * ==================================================
 */

function createDefaultLevelData() {
    return {
        /*
         * Permanent progression
         */
        level: 0,
        xp: 0,
        totalXp: 0,

        /*
         * Compatibility
         */
        lastMessage: 0,
        lastChatAt: 0,
        inactiveReminderAt: 0,
        rank: 0,

        /*
         * Activity
         */
        weeklyChatMinutes: 0,
        weeklyVoiceMinutes: 0,
        weeklyGames: 0,

        monthlyChatMinutes: 0,
        monthlyVoiceMinutes: 0,
        monthlyGames: 0,

        /*
         * Period tracking
         */
        weekStart:
            getWeekStart(),

        monthStart:
            getMonthStart(),

        /*
         * Failed periods
         */
        consecutiveFailedPeriods: 0,

        /*
         * Daily tracking
         */
        dailyChatMinutes: 0,
        dailyVoiceMinutes: 0,

        dailyChatDate:
            getDateKey(),

        dailyVoiceDate:
            getDateKey(),

        /*
         * XP boost
         */
        xpMultiplier: 1,

        xpMultiplierExpiresAt: 0,

        /*
         * Milestone rewards
         */
        milestoneRewards: {},

        /*
         * Hall of Fame history
         */
        levelHistory: [],

        updatedAt: Date.now()
    };
}

function normalizeLevelData(
    data
) {
    const defaults =
        createDefaultLevelData();

    return {
        ...defaults,
        ...data,

        level: clampNumber(
            data.level,
            MIN_LEVEL,
            MAX_LEVEL
        ),

        xp: clampNumber(
            data.xp,
            0,
            XP_PER_LEVEL - 1
        ),

        totalXp: Math.max(
            0,
            Number(data.totalXp) || 0
        ),

        lastChatAt:
            Math.max(
                0,
                Number(data.lastChatAt) || 0
            ),

        inactiveReminderAt:
            Math.max(
                0,
                Number(data.inactiveReminderAt) || 0
            ),

        weeklyChatMinutes:
            Math.max(
                0,
                Number(
                    data.weeklyChatMinutes
                ) || 0
            ),

        weeklyVoiceMinutes:
            Math.max(
                0,
                Number(
                    data.weeklyVoiceMinutes
                ) || 0
            ),

        weeklyGames:
            Math.max(
                0,
                Number(
                    data.weeklyGames
                ) || 0
            ),

        monthlyChatMinutes:
            Math.max(
                0,
                Number(
                    data.monthlyChatMinutes
                ) || 0
            ),

        monthlyVoiceMinutes:
            Math.max(
                0,
                Number(
                    data.monthlyVoiceMinutes
                ) || 0
            ),

        monthlyGames:
            Math.max(
                0,
                Number(
                    data.monthlyGames
                ) || 0
            ),

        consecutiveFailedPeriods:
            Math.max(
                0,
                Number(
                    data.consecutiveFailedPeriods
                ) || 0
            ),

        dailyChatMinutes:
            Math.max(
                0,
                Number(
                    data.dailyChatMinutes
                ) || 0
            ),

        dailyVoiceMinutes:
            Math.max(
                0,
                Number(
                    data.dailyVoiceMinutes
                ) || 0
            ),

        weekStart:
            Number(data.weekStart) ||
            getWeekStart(),

        monthStart:
            Number(data.monthStart) ||
            getMonthStart(),

        milestoneRewards:
            data.milestoneRewards &&
            typeof data.milestoneRewards ===
                'object'
                ? data.milestoneRewards
                : {},

        levelHistory:
            Array.isArray(
                data.levelHistory
            )
                ? data.levelHistory
                : []
    };
}

/*
 * ==================================================
 * DATE HELPERS
 * ==================================================
 */

const INDIA_TIME_ZONE = 'Asia/Kolkata';
const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIndiaDateParts(timestamp = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: INDIA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    }).formatToParts(new Date(timestamp));

    const get = type =>
        parts.find(part => part.type === type)?.value;

    return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        weekday: get('weekday')
    };
}

export function getDateKey(
    timestamp = Date.now()
) {
    const { year, month, day } =
        getIndiaDateParts(timestamp);

    return [
        year,
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0')
    ].join('-');
}

export function getWeekStart(
    timestamp = Date.now()
) {
    const { year, month, day, weekday } =
        getIndiaDateParts(timestamp);

    const weekdayIndex = {
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
        Sun: 0
    }[weekday];

    const daysFromMonday =
        weekdayIndex === 0
            ? 6
            : weekdayIndex - 1;

    const indiaMidnightUtc =
        Date.UTC(year, month - 1, day) -
        INDIA_OFFSET_MS;

    return (
        indiaMidnightUtc -
        daysFromMonday * 24 * 60 * 60 * 1000
    );
}

export function getMonthStart(
    timestamp = Date.now()
) {
    const { year, month } =
        getIndiaDateParts(timestamp);

    return (
        Date.UTC(year, month - 1, 1) -
        INDIA_OFFSET_MS
    );
}

/*
 * ==================================================
 * LEVEL PERIOD
 * ==================================================
 */

export function getLevelPeriod(
    level
) {
    return level >= MONTHLY_LEVEL_START
        ? 'monthly'
        : 'weekly';
}

/*
 * ==================================================
 * PERIOD RESET
 * ==================================================
 */

export function resetPeriodIfNeeded(
    userData,
    now = Date.now()
) {
    const currentWeek =
        getWeekStart(now);

    if (
        !userData.weekStart ||
        userData.weekStart !==
            currentWeek
    ) {
        userData.weekStart =
            currentWeek;

        userData.weeklyChatMinutes = 0;
        userData.weeklyVoiceMinutes = 0;
        userData.weeklyGames = 0;
    }

    const currentMonth =
        getMonthStart(now);

    if (
        !userData.monthStart ||
        userData.monthStart !==
            currentMonth
    ) {
        userData.monthStart =
            currentMonth;

        userData.monthlyChatMinutes = 0;
        userData.monthlyVoiceMinutes = 0;
        userData.monthlyGames = 0;
    }

    return userData;
}

export function resetDailyProgressIfNeeded(
    userData,
    now = Date.now()
) {
    const today =
        getDateKey(now);

    if (
        userData.dailyChatDate !==
        today
    ) {
        userData.dailyChatDate =
            today;

        userData.dailyChatMinutes = 0;
    }

    if (
        userData.dailyVoiceDate !==
        today
    ) {
        userData.dailyVoiceDate =
            today;

        userData.dailyVoiceMinutes = 0;
    }

    return userData;
}

export function resetWeeklyProgressIfNeeded(
    userData,
    now = Date.now()
) {
    return resetPeriodIfNeeded(
        userData,
        now
    );
}

/*
 * ==================================================
 * ACTIVITY REQUIREMENTS
 * ==================================================
 */

export function getActivityRequirements(
    level
) {
    const period =
        getLevelPeriod(
            level
        );

    if (
        period === 'monthly'
    ) {
        const { year, month } =
            getIndiaDateParts();

        const daysInMonth =
            new Date(
                Date.UTC(year, month, 0)
            ).getUTCDate();

        return {
            period: 'monthly',

            chatMinutes:
                LEVELING_REQUIREMENTS
                    .monthly
                    .chatMinutesPerDay *
                daysInMonth,

            voiceMinutes:
                LEVELING_REQUIREMENTS
                    .monthly
                    .voiceMinutesPerDay *
                daysInMonth,

            games:
                LEVELING_REQUIREMENTS
                    .monthly
                    .gamesPerMonth
        };
    }

    return {
        period: 'weekly',

        chatMinutes:
            LEVELING_REQUIREMENTS
                .weekly
                .chatMinutesPerWeek,

        voiceMinutes:
            LEVELING_REQUIREMENTS
                .weekly
                .voiceMinutesPerWeek,

        games:
            LEVELING_REQUIREMENTS
                .weekly
                .gamesPerWeek
    };
}

/*
 * ==================================================
 * ACTIVITY PROGRESS
 * ==================================================
 */

export function getActivityProgress(
    userData
) {
    const period =
        getLevelPeriod(
            userData.level
        );

    const requirements =
        getActivityRequirements(
            userData.level
        );

    let chatMinutes;
    let voiceMinutes;
    let games;

    if (
        period === 'monthly'
    ) {
        chatMinutes =
            userData.monthlyChatMinutes;

        voiceMinutes =
            userData.monthlyVoiceMinutes;

        games =
            userData.monthlyGames;
    } else {
        chatMinutes =
            userData.weeklyChatMinutes;

        voiceMinutes =
            userData.weeklyVoiceMinutes;

        games =
            userData.weeklyGames;
    }

    const chatProgress =
        Math.min(
            100,
            Math.floor(
                (
                    chatMinutes /
                    requirements.chatMinutes
                ) * 100
            )
        );

    const voiceProgress =
        Math.min(
            100,
            Math.floor(
                (
                    voiceMinutes /
                    requirements.voiceMinutes
                ) * 100
            )
        );

    const gamesProgress =
        Math.min(
            100,
            Math.floor(
                (
                    games /
                    requirements.games
                ) * 100
            )
        );

    return {
        period,

        chatMinutes,
        voiceMinutes,
        games,

        chatProgress,
        voiceProgress,
        gamesProgress,

        complete:
            chatProgress >= 100 &&
            voiceProgress >= 100 &&
            gamesProgress >= 100
    };
}

export function getWeeklyProgress(
    userData
) {
    return getActivityProgress(
        userData
    );
}

export function isActivityPeriodComplete(
    userData
) {
    return getActivityProgress(
        userData
    ).complete;
}

export function isWeeklyLevelReady(
    userData
) {
    return isActivityPeriodComplete(
        userData
    );
}

export function getWeeklyCompletionPercentage(
    userData
) {
    const progress =
        getActivityProgress(
            userData
        );

    return Math.floor(
        (
            progress.chatProgress +
            progress.voiceProgress +
            progress.gamesProgress
        ) / 3
    );
}

/*
 * ==================================================
 * ADD XP
 * ==================================================
 */

export async function addLevelXp(
    client,
    guildId,
    userId,
    amount
) {
    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return null;
    }

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    const oldLevel =
        userData.level;

    const multiplier =
        getActiveXpMultiplier(
            userData
        );

    const finalAmount =
        Math.max(
            0,
            Math.floor(
                amount *
                multiplier
            )
        );

    userData.xp +=
        finalAmount;

    userData.totalXp +=
        finalAmount;

    /*
     * Every 100 XP = 1 level.
     *
     * XP remainder carries over.
     */

    while (
        userData.xp >=
            XP_PER_LEVEL &&
        userData.level <
            MAX_LEVEL
    ) {
        userData.xp -=
            XP_PER_LEVEL;

        const previousLevel =
            userData.level;

        userData.level += 1;

        /*
         * Successful progression resets
         * failed-period counter.
         */

        userData.consecutiveFailedPeriods =
            0;

        /*
         * ==================================================
         * LEVEL 50 TRANSITION
         * ==================================================
         *
         * LEVEL 1-49:
         *     Weekly activity.
         *
         * LEVEL 50+:
         *     Monthly activity.
         *
         * When the member reaches Level 50,
         * previous activity is NOT carried over.
         */

        if (
            previousLevel <
                MONTHLY_LEVEL_START &&
            userData.level >=
                MONTHLY_LEVEL_START
        ) {
            /*
             * Keep monthly tracking synchronized
             * with the current calendar month.
             */

            userData.monthStart =
                getMonthStart();

            /*
             * Start Level 50 -> 51
             * monthly activity from zero.
             */

            userData.monthlyChatMinutes =
                0;

            userData.monthlyVoiceMinutes =
                0;

            userData.monthlyGames =
                0;

            /*
             * Weekly progression has ended
             * for this member.
             */

            userData.weeklyChatMinutes =
                0;

            userData.weeklyVoiceMinutes =
                0;

            userData.weeklyGames =
                0;

            userData.consecutiveFailedPeriods =
                0;
        }

        userData.levelHistory.push({
            level:
                userData.level,

            timestamp:
                Date.now()
        });

        if (
            userData.levelHistory.length >
            100
        ) {
            userData.levelHistory =
                userData.levelHistory.slice(
                    -100
                );
        }
    }

    if (userData.level > oldLevel) {
        try {
            const guild =
                client.guilds.cache.get(
                    guildId
                );

            if (guild) {
                const member =
                    await guild.members.fetch(
                        userId
                    );

                await handleLevelUpRewards(
                    client,
                    guild,
                    member,
                    userData,
                    oldLevel,
                    userData.level
                );
            }
        } catch (error) {
            logger.error(
                `[Leveling] Failed to process level-up rewards for ${userId}:`,
                error
            );
        }
    }

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return {
        level:
            userData.level,

        oldLevel,

        xp:
            userData.xp,

        totalXp:
            userData.totalXp,

        xpNeeded:
            XP_PER_LEVEL,

        levelsGained:
            userData.level -
            oldLevel,

        leveledUp:
            userData.level >
            oldLevel
    };
}

/*
 * ==================================================
 * CHAT ACTIVITY
 * ==================================================
 */

export async function addChatActivity(
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

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    resetPeriodIfNeeded(
        userData
    );

    resetDailyProgressIfNeeded(
        userData
    );

    userData.weeklyChatMinutes +=
        minutes;

    userData.monthlyChatMinutes +=
        minutes;

    userData.dailyChatMinutes +=
        minutes;

    // Track real chat activity separately from voice/game activity.
    // This timestamp drives the 7-day inactive-member reminder.
    userData.lastChatAt = Date.now();

    // A new message means the previous inactive period has ended.
    userData.inactiveReminderAt = 0;

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

/*
 * ==================================================
 * VOICE ACTIVITY
 * ==================================================
 */

export async function addVoiceActivity(
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

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    resetPeriodIfNeeded(
        userData
    );

    resetDailyProgressIfNeeded(
        userData
    );

    userData.weeklyVoiceMinutes +=
        minutes;

    userData.monthlyVoiceMinutes +=
        minutes;

    userData.dailyVoiceMinutes +=
        minutes;

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

/*
 * ==================================================
 * GAME ACTIVITY
 * ==================================================
 */

export async function addGameActivity(
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

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    resetPeriodIfNeeded(
        userData
    );

    userData.weeklyGames +=
        games;

    userData.monthlyGames +=
        games;

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}
/*
 * ==================================================
 * PERIOD FAILURE / XP DECAY
 * ==================================================
 *
 * IMPORTANT:
 *
 * Level NEVER decreases here.
 *
 * Only current XP is reduced.
 *
 * 1st failed period:
 *     XP / 2
 *
 * 2nd consecutive failed period:
 *     XP = 0
 *
 * After that:
 *     XP stays 0 until activity earns more.
 */

export async function processFailedPeriod(
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

    /*
     * Never reduce level.
     */

    const permanentLevel =
        userData.level;

    userData.consecutiveFailedPeriods +=
        1;

    if (
        userData.consecutiveFailedPeriods ===
        1
    ) {
        userData.xp =
            Math.floor(
                userData.xp / 2
            );
    } else {
        userData.xp = 0;
    }

    /*
     * Safety:
     * Level must remain exactly the same.
     */

    userData.level =
        permanentLevel;

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return {
        level:
            userData.level,

        xp:
            userData.xp,

        failedPeriods:
            userData.consecutiveFailedPeriods
    };
}

/*
 * ==================================================
 * CHECK PERIOD
 * ==================================================
 */

export async function checkActivityPeriod(
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

    resetPeriodIfNeeded(
        userData
    );

    const progress =
        getActivityProgress(
            userData
        );

    return {
        complete:
            progress.complete,

        progress,

        level:
            userData.level,

        xp:
            userData.xp
    };
}

/*
 * ==================================================
 * LEVEL SET / ADMIN
 * ==================================================
 */

export async function addLevels(
    client,
    guildId,
    userId,
    levels
) {
    if (
        !Number.isInteger(levels) ||
        levels <= 0
    ) {
        throw new TitanBotError(
            'Invalid level amount',
            ErrorTypes.VALIDATION,
            'You must add a positive number of levels.'
        );
    }

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    const oldLevel =
        userData.level;

    userData.level =
        Math.min(
            MAX_LEVEL,
            oldLevel + levels
        );

    userData.xp = 0;

    userData.totalXp =
        calculateTotalXp(
            userData.level,
            0
        );

    userData.consecutiveFailedPeriods =
        0;

    /*
     * If admin manually moves a member
     * into the monthly system, start
     * monthly activity fresh.
     */

    if (
        oldLevel <
            MONTHLY_LEVEL_START &&
        userData.level >=
            MONTHLY_LEVEL_START
    ) {
        userData.monthStart =
            getMonthStart();

        userData.monthlyChatMinutes =
            0;

        userData.monthlyVoiceMinutes =
            0;

        userData.monthlyGames =
            0;

        userData.weeklyChatMinutes =
            0;

        userData.weeklyVoiceMinutes =
            0;

        userData.weeklyGames =
            0;
    }

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

export async function removeLevels(
    client,
    guildId,
    userId,
    levels
) {
    if (
        !Number.isInteger(levels) ||
        levels <= 0
    ) {
        throw new TitanBotError(
            'Invalid level amount',
            ErrorTypes.VALIDATION,
            'You must remove a positive number of levels.'
        );
    }

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    /*
     * Admin can manually reduce a level.
     *
     * This does NOT erase milestone reward history.
     */

    userData.level =
        Math.max(
            MIN_LEVEL,
            userData.level -
                levels
        );

    userData.xp = 0;

    userData.totalXp =
        calculateTotalXp(
            userData.level,
            0
        );

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

export async function setUserLevel(
    client,
    guildId,
    userId,
    level
) {
    if (
        !Number.isInteger(level) ||
        level < MIN_LEVEL ||
        level > MAX_LEVEL
    ) {
        throw new TitanBotError(
            'Invalid level',
            ErrorTypes.VALIDATION,
            `Level must be between ${MIN_LEVEL} and ${MAX_LEVEL}.`
        );
    }

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    const oldLevel =
        userData.level;

    userData.level =
        level;

    userData.xp = 0;

    userData.totalXp =
        calculateTotalXp(
            level,
            0
        );

    /*
     * If admin manually sets a member
     * into Level 50+, initialize monthly
     * progression fresh.
     */

    if (
        oldLevel <
            MONTHLY_LEVEL_START &&
        level >=
            MONTHLY_LEVEL_START
    ) {
        userData.monthStart =
            getMonthStart();

        userData.monthlyChatMinutes =
            0;

        userData.monthlyVoiceMinutes =
            0;

        userData.monthlyGames =
            0;

        userData.weeklyChatMinutes =
            0;

        userData.weeklyVoiceMinutes =
            0;

        userData.weeklyGames =
            0;
    }

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

/*
 * ==================================================
 * XP BOOST
 * ==================================================
 */

export function getActiveXpMultiplier(
    userData
) {
    if (
        !userData.xpMultiplier ||
        userData.xpMultiplier <= 1
    ) {
        return 1;
    }

    if (
        !userData.xpMultiplierExpiresAt ||
        Date.now() >=
            userData.xpMultiplierExpiresAt
    ) {
        return 1;
    }

    return Number(
        userData.xpMultiplier
    ) || 1;
}

export async function setXpMultiplier(
    client,
    guildId,
    userId,
    multiplier,
    durationMs
) {
    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    userData.xpMultiplier =
        Math.max(
            1,
            Number(multiplier) || 1
        );

    userData.xpMultiplierExpiresAt =
        Date.now() +
        Math.max(
            0,
            Number(durationMs) || 0
        );

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

/*
 * ==================================================
 * MILESTONE HELPERS
 * ==================================================
 */

export function getMilestoneReward(
    level
) {
    return (
        LEVEL_MILESTONES[
            Number(level)
        ] || null
    );
}

export function hasMilestoneReward(
    userData,
    level
) {
    return Boolean(
        userData
            .milestoneRewards?.[
                String(level)
            ]
    );
}

export function markMilestoneRewardClaimed(
    userData,
    level
) {
    if (
        !userData.milestoneRewards
    ) {
        userData.milestoneRewards =
            {};
    }

    userData.milestoneRewards[
        String(level)
    ] = true;

    return userData;
}

/*
 * ==================================================
 * LEADERBOARD
 * ==================================================
 */

export async function getLeaderboard(
    client,
    guildId,
    limit = 10
) {
    try {
        if (
            !Number.isInteger(limit) ||
            limit < 1
        ) {
            limit = 10;
        }

        limit =
            Math.min(
                limit,
                100
            );

        const guild =
            client.guilds.cache.get(
                guildId
            );

        if (!guild) {
            return [];
        }

        const members =
            await guild.members
                .fetch()
                .catch(
                    () => new Map()
                );

        const leaderboard = [];

        for (
            const [
                userId,
                member
            ]
            of members
        ) {
            if (
                member.user.bot
            ) {
                continue;
            }

            const data =
                await getUserLevelData(
                    client,
                    guildId,
                    userId
                );

            if (
                data &&
                (
                    data.level > 0 ||
                    data.totalXp > 0 ||
                    data.xp > 0
                )
            ) {
                leaderboard.push({
                    userId,

                    username:
                        member.user.username,

                    discriminator:
                        member.user
                            .discriminator,

                    ...data
                });
            }
        }

        leaderboard.sort(
            (a, b) =>
                b.level -
                    a.level ||
                b.xp -
                    a.xp ||
                b.totalXp -
                    a.totalXp
        );

        leaderboard.forEach(
            (
                entry,
                index
            ) => {
                entry.rank =
                    index + 1;
            }
        );

        return leaderboard.slice(
            0,
            limit
        );
    } catch (error) {
        logger.error(
            'Error getting leaderboard:',
            error
        );

        throw new TitanBotError(
            `Failed to fetch leaderboard: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not fetch the leaderboard.'
        );
    }
}

export function createLeaderboardEmbed(
    leaderboard,
    guild
) {
    const embed =
        new EmbedBuilder()
            .setTitle(
                `🏆 ${guild.name} Leaderboard`
            )
            .setColor(
                '#2ecc71'
            )
            .setTimestamp();

    if (
        !leaderboard ||
        leaderboard.length === 0
    ) {
        embed.setDescription(
            'No users on the leaderboard yet!'
        );

        return embed;
    }

    const text =
        leaderboard
            .map(
                (
                    user,
                    index
                ) => {
                    const medal =
                        index === 0
                            ? '🥇'
                            : index === 1
                                ? '🥈'
                                : index === 2
                                    ? '🥉'
                                    : `**${index + 1}.**`;

                    return (
                        `${medal} ${user.username} ` +
                        `- Level ${user.level} ` +
                        `(${user.xp}/${XP_PER_LEVEL} XP)`
                    );
                }
            )
            .join('\n');

    embed.setDescription(
        `**Top Members**\n${text}`
    );

    return embed;
}

/*
 * ==================================================
 * DELETE
 * ==================================================
 */

export async function deleteUserLevelData(
    client,
    guildId,
    userId
) {
    try {
        const key =
            getUserLevelKey(
                guildId,
                userId
            );

        await client.db.delete(
            key
        );

        logger.debug(
            `Deleted level data for ${userId} in guild ${guildId}`
        );
    } catch (error) {
        logger.error(
            `Error deleting level data for ${userId}:`,
            error
        );

        throw error;
    }
}

/*
 * ==================================================
 * UTILITY
 * ==================================================
 */

function clampNumber(
    value,
    min,
    max
) {
    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {
        return min;
    }

    return Math.max(
        min,
        Math.min(
            max,
            Math.floor(number)
        )
    );
}
