import { EmbedBuilder, ChannelType } from 'discord.js';
import { getEconomyPrefix, getUserLevelPrefix } from '../utils/database.js';
import { getMonthStart } from './leveling/leveling.js';
import { logger } from '../utils/logger.js';

const LEADERBOARD_CHANNEL_ID = '1552041065261957210';
const LEADERBOARD_MESSAGE_KEY = (guildId) =>
    `guild:${guildId}:leaderboard:message`;

const LEADERBOARD_SNAPSHOT_KEY = (guildId, monthKey) =>
    `guild:${guildId}:leaderboard:snapshot:${monthKey}`;

const REWARD_SOULS = {
    1: 100000,
    2: 50000,
    3: 10000
};

const REWARD_SHARDS = {
    1: 10,
    2: 5,
    3: 3
};

const LEADERBOARD_CATEGORIES = [
    ['richest', 'Richest'],
    ['highestLevel', 'Highest Level'],
    ['mostGames', 'Most Games'],
    ['luckiest', 'Luckiest'],
    ['mostShards', 'Most Shards'],
    ['longestStreak', 'Longest Streak']
];

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';

const RANK_EMOJIS = ['🥇', '🥈', '🥉'];

function unwrap(data) {
    if (
        data &&
        typeof data === 'object' &&
        data.ok !== undefined &&
        data.value !== undefined
    ) {
        return unwrap(data.value);
    }

    return data;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function getMonthLabel(now = new Date()) {
    return new Intl.DateTimeFormat('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
    }).format(now);
}

function getCurrentMonthKey(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        timeZone: 'Asia/Kolkata'
    }).formatToParts(now);

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;

    return `${year}-${month}`;
}

function getPreviousMonthKey(monthKey) {
    const [year, month] = String(monthKey)
        .split('-')
        .map(Number);

    const date = new Date(Date.UTC(year, month - 2, 1));

    return `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1
    ).padStart(2, '0')}`;
}

function isExcludedMember(member, guild) {
    if (!member || member.user?.bot) {
        return true;
    }

    if (member.id === guild.ownerId) {
        return true;
    }

    return member.roles.cache.some(role => {
        const roleName = role.name
            .normalize('NFKC')
            .replace(/[^a-z0-9]/gi, '')
            .toLowerCase();

        return roleName.includes('creator');
    });
}

async function listKeys(client, prefix) {
    if (!client.db || typeof client.db.list !== 'function') {
        return [];
    }

    const rawKeys = await client.db.list(prefix);

    if (Array.isArray(rawKeys)) {
        return rawKeys;
    }

    if (rawKeys && typeof rawKeys === 'object') {
        return Object.keys(rawKeys).filter(key => key.startsWith(prefix));
    }

    return [];
}

async function buildLeaderboardData(client, guild) {
    const now = new Date();
    const currentMonthStart = getMonthStart(now);
    const currentMonthKey = getCurrentMonthKey(now);

    // Fetch the current member list so deleted/left users never appear,
    // and so the server owner / Creator role can be excluded reliably.
    await guild.members.fetch();

    const eligibleMembers = guild.members.cache.filter(
        member => !isExcludedMember(member, guild)
    );

    const [economyKeys, levelKeys] = await Promise.all([
        listKeys(client, getEconomyPrefix(guild.id)),
        listKeys(client, getUserLevelPrefix(guild.id))
    ]);

    const userIds = new Set([
        ...economyKeys.map(key =>
            key.slice(getEconomyPrefix(guild.id).length)
        ),
        ...levelKeys.map(key =>
            key.slice(getUserLevelPrefix(guild.id).length)
        )
    ]);

    const entries = [];

    for (const userId of userIds) {
        const member = eligibleMembers.get(userId);

        if (!member) {
            continue;
        }

        try {
            const [economyData, levelData] = await Promise.all([
                client.db.get(
                    `${getEconomyPrefix(guild.id)}${userId}`,
                    null
                ),
                client.db.get(
                    `${getUserLevelPrefix(guild.id)}${userId}`,
                    null
                )
            ]);

            const economy = unwrap(economyData) || {};
            const level = unwrap(levelData) || {};

            const monthStart = Number(level.monthStart) || 0;

            const monthlyGames =
                monthStart === currentMonthStart
                    ? Math.max(0, Number(level.monthlyGames) || 0)
                    : 0;

            const stats =
                economy.leaderboardStats &&
                typeof economy.leaderboardStats === 'object'
                    ? economy.leaderboardStats
                    : {};

            const luckyDrops =
                stats.month === currentMonthKey
                    ? Math.max(0, Number(stats.luckyDrops) || 0)
                    : 0;

            entries.push({
                userId,
                member,
                totalSouls:
                    Math.max(0, Number(economy.wallet) || 0) +
                    Math.max(0, Number(economy.bank) || 0),
                level: Math.max(0, Number(level.level) || 0),
                games: monthlyGames,
                luckyDrops,
                shards: Math.max(0, Number(economy.shards) || 0),
                streak: Math.max(0, Number(economy.dailyStreak) || 0)
            });
        } catch (error) {
            logger.debug(
                `[Leaderboards] Skipping ${userId}: ${error.message}`
            );
        }
    }

    return {
        monthLabel: getMonthLabel(now),
        monthKey: currentMonthKey,
        richest: [...entries].sort((a, b) => b.totalSouls - a.totalSouls),
        highestLevel: [...entries].sort(
            (a, b) => b.level - a.level || b.totalSouls - a.totalSouls
        ),
        mostGames: [...entries].sort(
            (a, b) => b.games - a.games || b.totalSouls - a.totalSouls
        ),
        luckiest: [...entries].sort(
            (a, b) => b.luckyDrops - a.luckyDrops || b.games - a.games
        ),
        mostShards: [...entries].sort(
            (a, b) => b.shards - a.shards || b.totalSouls - a.totalSouls
        ),
        longestStreak: [...entries].sort(
            (a, b) => b.streak - a.streak || b.level - a.level
        )
    };
}

function createMonthlySnapshot(data) {
    const snapshot = {
        monthKey: data.monthKey
    };

    for (const [key] of LEADERBOARD_CATEGORIES) {
        snapshot[key] = data[key]
            .slice(0, 3)
            .map(entry => entry.userId);
    }

    return snapshot;
}

async function rewardPreviousMonthOnce(client, guild, previousMonthKey) {
    const pool = client?.db?.db?.pool;
    let connection = null;

    try {
        if (!pool || typeof pool.connect !== 'function') {
            return await rewardPreviousMonth(client, guild, previousMonthKey);
        }

        connection = await pool.connect();
        const lockKey = `niko:leaderboard-reward:${guild.id}:${previousMonthKey}`;
        const lockResult = await connection.query(
            'SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked',
            [lockKey]
        );

        if (!lockResult.rows[0]?.locked) {
            logger.debug(
                `[Leaderboards] Reward processing already running elsewhere for guild ${guild.id}, month ${previousMonthKey}.`
            );
            return false;
        }

        try {
            return await rewardPreviousMonth(client, guild, previousMonthKey);
        } finally {
            await connection.query(
                'SELECT pg_advisory_unlock(hashtext($1)::bigint)',
                [lockKey]
            );
        }
    } catch (error) {
        logger.error(
            `[Leaderboards] Failed to acquire reward lock for guild ${guild.id}:`,
            error
        );
        return false;
    } finally {
        connection?.release();
    }
}

async function rewardPreviousMonth(client, guild, previousMonthKey) {
    const snapshot =
        await client.db.get(
            LEADERBOARD_SNAPSHOT_KEY(guild.id, previousMonthKey),
            null
        );

    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }

    let rewardedCount = 0;

    for (const [categoryKey, categoryName] of LEADERBOARD_CATEGORIES) {
        const winners = Array.isArray(snapshot[categoryKey])
            ? snapshot[categoryKey].slice(0, 3)
            : [];

        for (let index = 0; index < winners.length; index += 1) {
            const userId = winners[index];
            const rank = index + 1;

            if (!userId) {
                continue;
            }

            const member = guild.members.cache.get(userId);

            if (!member || isExcludedMember(member, guild)) {
                continue;
            }

            try {
                const economyKey = getEconomyPrefix(guild.id) + userId;
                const economyData = await client.db.get(
                    economyKey,
                    null
                );

                const economy = unwrap(economyData);

                if (!economy || typeof economy !== 'object') {
                    continue;
                }

                const rewards =
                    economy.leaderboardRewards &&
                    typeof economy.leaderboardRewards === 'object'
                        ? economy.leaderboardRewards
                        : {};

                const monthRewards =
                    rewards[previousMonthKey] &&
                    typeof rewards[previousMonthKey] === 'object'
                        ? rewards[previousMonthKey]
                        : {};

                if (monthRewards[categoryKey]) {
                    continue;
                }

                economy.wallet =
                    Math.max(0, Number(economy.wallet) || 0) +
                    REWARD_SOULS[rank];

                economy.shards =
                    Math.max(0, Number(economy.shards) || 0) +
                    REWARD_SHARDS[rank];

                economy.leaderboardRewards = {
                    ...rewards,
                    [previousMonthKey]: {
                        ...monthRewards,
                        [categoryKey]: rank
                    }
                };

                const saved = await client.db.set(
                    economyKey,
                    economy
                );

                if (!saved) {
                    continue;
                }

                rewardedCount += 1;

                logger.info(
                    `[Leaderboards] ${categoryName} #${rank} reward given to ${userId} for ${previousMonthKey}: ${REWARD_SHARDS[rank]} Shards + ${REWARD_SOULS[rank].toLocaleString()} Souls.`
                );
            } catch (error) {
                logger.error(
                    `[Leaderboards] Failed to reward ${categoryName} #${rank} winner ${userId}:`,
                    error
                );
            }
        }
    }

    return rewardedCount > 0;
}

function renderEntries(entries, formatter) {
    const top = entries.slice(0, 3);

    if (top.length === 0 || top.every(entry => formatter(entry) === null)) {
        return 'No leaderboard data yet.';
    }

    return top
        .map((entry, index) => {
            const rank = RANK_EMOJIS[index] || `**#${index + 1}**`;
            const value = formatter(entry);

            return value === null
                ? `${rank} — No activity yet`
                : `${rank} <@${entry.userId}> — ${value}`;
        })
        .join('\n');
}

function buildEmbed(data) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🏆 Hollow Devil's Domain — Leaderboards")
        .setDescription(
            `**Monthly Leaderboards — ${data.monthLabel}**\n\n` +
            'Owner and **Creator** members are excluded from every leaderboard.\n\n' +
            '**Monthly Rewards — each leaderboard**\n' +
            `🥇 10 Shards + ${formatNumber(REWARD_SOULS[1])} Souls\n` +
            `🥈 5 Shards + ${formatNumber(REWARD_SOULS[2])} Souls\n` +
            `🥉 3 Shards + ${formatNumber(REWARD_SOULS[3])} Souls`
        )
        .addFields(
            {
                name: `${TOTAL_SOULS_EMOJI} Richest`,
                value: renderEntries(
                    data.richest,
                    entry =>
                        entry.totalSouls > 0
                            ? `${TOTAL_SOULS_EMOJI} **${formatNumber(entry.totalSouls)}**`
                            : null
                ),
                inline: false
            },
            {
                name: '⭐ Highest Level',
                value: renderEntries(
                    data.highestLevel,
                    entry =>
                        entry.level > 0
                            ? `Level **${formatNumber(entry.level)}**`
                            : null
                ),
                inline: false
            },
            {
                name: '🎮 Most Games',
                value: renderEntries(
                    data.mostGames,
                    entry =>
                        entry.games > 0
                            ? `**${formatNumber(entry.games)}** games`
                            : null
                ),
                inline: false
            },
            {
                name: '🎰 Luckiest',
                value: renderEntries(
                    data.luckiest,
                    entry =>
                        entry.luckyDrops > 0
                            ? `**${formatNumber(entry.luckyDrops)}** lucky drops`
                            : null
                ),
                inline: false
            },
            {
                name: `${SHARD_EMOJI} Most Shards`,
                value: renderEntries(
                    data.mostShards,
                    entry =>
                        entry.shards > 0
                            ? `${SHARD_EMOJI} **${formatNumber(entry.shards)}** Shards`
                            : null
                ),
                inline: false
            },
            {
                name: '🔥 Longest Streak',
                value: renderEntries(
                    data.longestStreak,
                    entry =>
                        entry.streak > 0
                            ? `**${formatNumber(entry.streak)}** days`
                            : null
                ),
                inline: false
            }
        )
        .setFooter({
            text: 'Niko • Updates automatically'
        })
        .setTimestamp();

    return embed;
}

async function upsertLeaderboardMessage(client, guild, embed) {
    const channel = guild.channels.cache.get(LEADERBOARD_CHANNEL_ID);

    if (
        !channel ||
        ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) ||
        !channel.isTextBased()
    ) {
        logger.warn(
            `[Leaderboards] Channel ${LEADERBOARD_CHANNEL_ID} not found or is not text-based in guild ${guild.id}.`
        );
        return false;
    }

    const messageKey = LEADERBOARD_MESSAGE_KEY(guild.id);
    let messageId = await client.db.get(messageKey, null);
    let message = null;

    if (messageId) {
        try {
            message = await channel.messages.fetch(messageId);
        } catch (error) {
            logger.debug(
                `[Leaderboards] Stored message could not be fetched: ${error.message}`
            );
        }
    }

    // Recover the monthly leaderboard message if the stored ID is missing or
    // stale. This prevents a new message from being posted every scheduler run.
    if (!message) {
        try {
            const recentMessages = await channel.messages.fetch({ limit: 100 });

            message = recentMessages.find(candidate =>
                candidate.author?.id === client.user.id &&
                candidate.embeds?.[0]?.title === "🏆 Hollow Devil's Domain — Leaderboards"
            ) || null;

            if (message) {
                messageId = message.id;
                const saved = await client.db.set(messageKey, messageId);

                if (!saved) {
                    logger.warn(
                        `[Leaderboards] Failed to persist recovered leaderboard message ID for guild ${guild.id}.`
                    );
                }
            }
        } catch (error) {
            logger.debug(
                `[Leaderboards] Could not scan recent leaderboard messages: ${error.message}`
            );
        }
    }

    if (message) {
        try {
            await message.edit({
                embeds: [embed]
            });

            // Keep exactly one current monthly leaderboard message. Older
            // duplicate Niko leaderboard messages are removed when found.
            try {
                const recentMessages = await channel.messages.fetch({ limit: 100 });

                const duplicates = recentMessages.filter(candidate =>
                    candidate.id !== message.id &&
                    candidate.author?.id === client.user.id &&
                    candidate.embeds?.[0]?.title === "🏆 Hollow Devil's Domain — Leaderboards"
                );

                await Promise.all(
                    duplicates.map(candidate => candidate.delete().catch(() => null))
                );
            } catch (error) {
                logger.debug(
                    `[Leaderboards] Could not clean duplicate leaderboard messages: ${error.message}`
                );
            }

            return true;
        } catch (error) {
            logger.debug(
                `[Leaderboards] Stored leaderboard message could not be edited: ${error.message}`
            );
        }
    }

    const newMessage = await channel.send({
        embeds: [embed]
    });

    const saved = await client.db.set(
        messageKey,
        newMessage.id
    );

    if (!saved) {
        logger.warn(
            `[Leaderboards] Failed to persist leaderboard message ID for guild ${guild.id}.`
        );
    }

    return true;
}

export async function updateLeaderboards(client) {
    if (!client?.db || client.db.isDegraded?.()) {
        logger.debug('[Leaderboards] Skipping update because persistent database is unavailable.');
        return;
    }

    for (const guild of client.guilds.cache.values()) {
        try {
            const channel = guild.channels.cache.get(LEADERBOARD_CHANNEL_ID);

            if (!channel) {
                continue;
            }

            const data = await buildLeaderboardData(client, guild);

            // Monthly rewards are finalized only on the 1st day of a new
            // India-calendar month. The database advisory lock also prevents
            // duplicate rewards if two Niko instances are online at once.
            const indiaDay = new Intl.DateTimeFormat('en-IN', {
                day: '2-digit',
                timeZone: 'Asia/Kolkata'
            }).format(new Date());

            if (indiaDay === '01') {
                const previousMonthKey = getPreviousMonthKey(data.monthKey);
                await rewardPreviousMonthOnce(
                    client,
                    guild,
                    previousMonthKey
                );
            }

            await client.db.set(
                LEADERBOARD_SNAPSHOT_KEY(guild.id, data.monthKey),
                createMonthlySnapshot(data)
            );

            const embed = buildEmbed(data);

            await upsertLeaderboardMessage(client, guild, embed);

            logger.info(
                `[Leaderboards] Updated leaderboard channel for guild ${guild.id}.`
            );
        } catch (error) {
            logger.error(
                `[Leaderboards] Failed to update guild ${guild.id}:`,
                error
            );
        }
    }
}

export { LEADERBOARD_CHANNEL_ID };
