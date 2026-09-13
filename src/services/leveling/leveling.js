// leveling.js

import { EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { getGuildConfig, setGuildConfig } from '../config/guildConfig.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getUserLevelKey } from '../../utils/database/keys.js';

const MAX_LEVEL = 1000;
const MIN_LEVEL = 0;

// Weekly leveling requirements
export const LEVELING_REQUIREMENTS = {
    chatMinutesPerDay: 300,      // 5 hours
    voiceMinutesPerDay: 180,     // 3 hours
    gamesPerWeek: 15,

    chatMinutesPerWeek: 300 * 7,
    voiceMinutesPerWeek: 180 * 7,
};

// --------------------------------------------------
// XP
// --------------------------------------------------

export function getXpForLevel(level) {
    if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) {
        throw new TitanBotError(
            `Invalid level: ${level}`,
            ErrorTypes.VALIDATION,
            `Level must be between ${MIN_LEVEL} and ${MAX_LEVEL}.`
        );
    }

    return 5 * Math.pow(level, 2) + 50 * level + 50;
}

export function getLevelFromXp(xp) {
    if (!Number.isInteger(xp) || xp < 0) {
        throw new TitanBotError(
            `Invalid XP: ${xp}`,
            ErrorTypes.VALIDATION,
            'XP must be a non-negative number.'
        );
    }

    let level = 0;
    let remainingXp = xp;

    while (
        level < MAX_LEVEL &&
        remainingXp >= getXpForLevel(level)
    ) {
        remainingXp -= getXpForLevel(level);
        level++;
    }

    return {
        level,
        currentXp: remainingXp,
        xpNeeded: getXpForLevel(level)
    };
}

export function calculateTotalXp(level, currentXp = 0) {
    let total = currentXp;

    for (let i = 0; i < level; i++) {
        total += getXpForLevel(i);
    }

    return total;
}

// --------------------------------------------------
// Leveling Config
// --------------------------------------------------

export async function getLevelingConfig(client, guildId) {
    try {
        const guildConfig = await getGuildConfig(client, guildId);

        return guildConfig.leveling || {
            enabled: true,

            // New activity system
            chatMinutesPerDay: LEVELING_REQUIREMENTS.chatMinutesPerDay,
            voiceMinutesPerDay: LEVELING_REQUIREMENTS.voiceMinutesPerDay,
            gamesPerWeek: LEVELING_REQUIREMENTS.gamesPerWeek,

            chatMinutesPerWeek: LEVELING_REQUIREMENTS.chatMinutesPerWeek,
            voiceMinutesPerWeek: LEVELING_REQUIREMENTS.voiceMinutesPerWeek,

            // Existing compatibility settings
            levelUpMessage: '{user} has reached level {level}!',
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

            chatMinutesPerDay: LEVELING_REQUIREMENTS.chatMinutesPerDay,
            voiceMinutesPerDay: LEVELING_REQUIREMENTS.voiceMinutesPerDay,
            gamesPerWeek: LEVELING_REQUIREMENTS.gamesPerWeek,

            chatMinutesPerWeek: LEVELING_REQUIREMENTS.chatMinutesPerWeek,
            voiceMinutesPerWeek: LEVELING_REQUIREMENTS.voiceMinutesPerWeek,

            levelUpMessage: '{user} has reached level {level}!',
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

export async function saveLevelingConfig(client, guildId, config) {
    try {
        if (!guildId || !config) {
            throw new TitanBotError(
                'Guild ID and config are required',
                ErrorTypes.VALIDATION
            );
        }

        const guildConfig =
            await getGuildConfig(client, guildId);

        guildConfig.leveling = config;

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

        if (error instanceof TitanBotError) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to save config: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not save leveling configuration.'
        );
    }
}

// --------------------------------------------------
// User Level Data
// --------------------------------------------------

export async function getUserLevelData(
    client,
    guildId,
    userId
) {
    try {
        if (!guildId || !userId) {
            throw new TitanBotError(
                'Guild ID and User ID are required',
                ErrorTypes.VALIDATION
            );
        }

        const key =
            getUserLevelKey(guildId, userId);

        const data =
            await client.db.get(key);

        if (!data) {
            return createDefaultLevelData();
        }

        return normalizeLevelData(data);
    } catch (error) {
        logger.error(
            `Error getting level data for ${userId}:`,
            error
        );

        if (error instanceof TitanBotError) {
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
        if (!guildId || !userId) {
            throw new TitanBotError(
                'Guild ID and User ID are required',
                ErrorTypes.VALIDATION
            );
        }

        if (!data || typeof data !== 'object') {
            throw new TitanBotError(
                'Invalid user level data',
                ErrorTypes.VALIDATION
            );
        }

        const sanitizedData =
            normalizeLevelData(data);

        sanitizedData.updatedAt =
            Date.now();

        const key =
            getUserLevelKey(guildId, userId);

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

        if (error instanceof TitanBotError) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to save user level data: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not save level data.'
        );
    }
}

function createDefaultLevelData() {
    return {
        // Permanent level data
        xp: 0,
        level: 0,
        totalXp: 0,

        // Compatibility
        lastMessage: 0,
        rank: 0,

        // Weekly activity
        weeklyChatMinutes: 0,
        weeklyVoiceMinutes: 0,
        weeklyGames: 0,

        // Current week
        weekStart: getWeekStart(),

        // Daily tracking
        dailyChatMinutes: 0,
        dailyVoiceMinutes: 0,
        dailyChatDate: getDateKey(),
        dailyVoiceDate: getDateKey(),

        // XP multiplier
        xpMultiplier: 1,
        xpMultiplierExpiresAt: 0,

        // Reward tracking
        milestoneRewards: {},

        // Hall of Fame
        levelHistory: []
    };
}

function normalizeLevelData(data) {
    const defaults =
        createDefaultLevelData();

    return {
        ...defaults,
        ...data,

        xp: Math.max(
            0,
            Number(data.xp) || 0
        ),

        level: Math.max(
            MIN_LEVEL,
            Math.min(
                Number(data.level) || 0,
                MAX_LEVEL
            )
        ),

        totalXp: Math.max(
            0,
            Number(data.totalXp) || 0
        ),

        weeklyChatMinutes: Math.max(
            0,
            Number(data.weeklyChatMinutes) || 0
        ),

        weeklyVoiceMinutes: Math.max(
            0,
            Number(data.weeklyVoiceMinutes) || 0
        ),

        weeklyGames: Math.max(
            0,
            Number(data.weeklyGames) || 0
        ),

        dailyChatMinutes: Math.max(
            0,
            Number(data.dailyChatMinutes) || 0
        ),

        dailyVoiceMinutes: Math.max(
            0,
            Number(data.dailyVoiceMinutes) || 0
        ),

        weekStart:
            Number(data.weekStart) ||
            getWeekStart(),

        milestoneRewards:
            data.milestoneRewards &&
            typeof data.milestoneRewards === 'object'
                ? data.milestoneRewards
                : {},

        levelHistory:
            Array.isArray(data.levelHistory)
                ? data.levelHistory
                : []
    };
}

// --------------------------------------------------
// Weekly Activity
// --------------------------------------------------

export function getWeekStart(timestamp = Date.now()) {
    const date =
        new Date(timestamp);

    const day =
        date.getDay();

    const diff =
        day === 0 ? 6 : day - 1;

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

export function getDateKey(timestamp = Date.now()) {
    const date =
        new Date(timestamp);

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

export function resetWeeklyProgressIfNeeded(
    userData,
    now = Date.now()
) {
    const currentWeek =
        getWeekStart(now);

    if (
        !userData.weekStart ||
        userData.weekStart !== currentWeek
    ) {
        userData.weekStart =
            currentWeek;

        userData.weeklyChatMinutes = 0;
        userData.weeklyVoiceMinutes = 0;
        userData.weeklyGames = 0;
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
        userData.dailyChatDate !== today
    ) {
        userData.dailyChatDate =
            today;

        userData.dailyChatMinutes = 0;
    }

    if (
        userData.dailyVoiceDate !== today
    ) {
        userData.dailyVoiceDate =
            today;

        userData.dailyVoiceMinutes = 0;
    }

    return userData;
}

// --------------------------------------------------
// Activity Progress
// --------------------------------------------------

export function getWeeklyProgress(userData) {
    const chatProgress =
        Math.min(
            100,
            Math.floor(
                (
                    userData.weeklyChatMinutes /
                    LEVELING_REQUIREMENTS.chatMinutesPerWeek
                ) * 100
            )
        );

    const voiceProgress =
        Math.min(
            100,
            Math.floor(
                (
                    userData.weeklyVoiceMinutes /
                    LEVELING_REQUIREMENTS.voiceMinutesPerWeek
                ) * 100
            )
        );

    const gamesProgress =
        Math.min(
            100,
            Math.floor(
                (
                    userData.weeklyGames /
                    LEVELING_REQUIREMENTS.gamesPerWeek
                ) * 100
            )
        );

    return {
        chatMinutes:
            userData.weeklyChatMinutes,

        voiceMinutes:
            userData.weeklyVoiceMinutes,

        games:
            userData.weeklyGames,

        chatProgress,
        voiceProgress,
        gamesProgress,

        complete:
            chatProgress >= 100 &&
            voiceProgress >= 100 &&
            gamesProgress >= 100
    };
}

export function isWeeklyLevelReady(userData) {
    return getWeeklyProgress(userData).complete;
}

export function getWeeklyCompletionPercentage(userData) {
    const progress =
        getWeeklyProgress(userData);

    return Math.floor(
        (
            progress.chatProgress +
            progress.voiceProgress +
            progress.gamesProgress
        ) / 3
    );
}

// --------------------------------------------------
// Activity Recording
// --------------------------------------------------

export async function addChatActivity(
    client,
    guildId,
    userId,
    minutes
) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return null;
    }

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    resetWeeklyProgressIfNeeded(userData);
    resetDailyProgressIfNeeded(userData);

    userData.weeklyChatMinutes += minutes;
    userData.dailyChatMinutes += minutes;

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

export async function addVoiceActivity(
    client,
    guildId,
    userId,
    minutes
) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return null;
    }

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    resetWeeklyProgressIfNeeded(userData);
    resetDailyProgressIfNeeded(userData);

    userData.weeklyVoiceMinutes += minutes;
    userData.dailyVoiceMinutes += minutes;

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

export async function addGameActivity(
    client,
    guildId,
    userId,
    games = 1
) {
    if (!Number.isInteger(games) || games <= 0) {
        return null;
    }

    const userData =
        await getUserLevelData(
            client,
            guildId,
            userId
        );

    resetWeeklyProgressIfNeeded(userData);

    userData.weeklyGames += games;

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    return userData;
}

// --------------------------------------------------
// Level Up
// --------------------------------------------------

export async function levelUpUser(
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

    if (userData.level >= MAX_LEVEL) {
        return {
            leveledUp: false,
            userData
        };
    }

    if (!isWeeklyLevelReady(userData)) {
        return {
            leveledUp: false,
            userData
        };
    }

    const oldLevel =
        userData.level;

    const newLevel =
        Math.min(
            oldLevel + 1,
            MAX_LEVEL
        );

    userData.level =
        newLevel;

    userData.xp = 0;

    userData.totalXp =
        calculateTotalXp(
            newLevel,
            0
        );

    // Reset weekly activity after successful level-up
    userData.weeklyChatMinutes = 0;
    userData.weeklyVoiceMinutes = 0;
    userData.weeklyGames = 0;
    userData.weekStart =
        getWeekStart();

    // Hall of Fame history
    userData.levelHistory =
        Array.isArray(userData.levelHistory)
            ? userData.levelHistory
            : [];

    userData.levelHistory.push({
        level: newLevel,
        timestamp: Date.now()
    });

    // Keep history manageable
    if (userData.levelHistory.length > 100) {
        userData.levelHistory =
            userData.levelHistory.slice(-100);
    }

    await saveUserLevelData(
        client,
        guildId,
        userId,
        userData
    );

    logger.info(
        `🎉 User ${userId} reached level ${newLevel} in guild ${guildId}`
    );

    return {
        leveledUp: true,
        oldLevel,
        newLevel,
        userData
    };
}

// --------------------------------------------------
// Admin Compatibility
// --------------------------------------------------

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

    const newLevel =
        Math.min(
            MAX_LEVEL,
            userData.level + levels
        );

    userData.level =
        newLevel;

    userData.xp = 0;

    userData.totalXp =
        calculateTotalXp(
            newLevel,
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

    const newLevel =
        Math.max(
            MIN_LEVEL,
            userData.level - levels
        );

    userData.level =
        newLevel;

    userData.xp = 0;

    userData.totalXp =
        calculateTotalXp(
            newLevel,
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

    userData.level =
        level;

    userData.xp = 0;

    userData.totalXp =
        calculateTotalXp(
            level,
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

// --------------------------------------------------
// Leaderboard Compatibility
// --------------------------------------------------

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
                .catch(() => new Map());

        const leaderboard = [];

        for (
            const [userId, member]
            of members
        ) {
            if (member.user.bot) {
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
                    data.totalXp > 0 ||
                    data.level > 0
                )
            ) {
                leaderboard.push({
                    userId,
                    username:
                        member.user.username,
                    discriminator:
                        member.user.discriminator,
                    ...data
                });
            }
        }

        leaderboard.sort(
            (a, b) =>
                b.level - a.level ||
                b.totalXp - a.totalXp
        );

        leaderboard.forEach(
            (entry, index) => {
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
            .setColor('#2ecc71')
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
            .map((user, index) => {
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
                    `- Level ${user.level}`
                );
            })
            .join('\n');

    embed.setDescription(
        `**Top Members**\n${text}`
    );

    return embed;
}

// --------------------------------------------------
// Delete
// --------------------------------------------------

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

        await client.db.delete(key);

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
