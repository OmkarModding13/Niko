import { AttachmentBuilder } from 'discord.js';

import {
    getEconomyData,
    setEconomyData
} from '../../utils/economy.js';

import {
    createLevelUpImage
} from './levelUpImage.js';

import { logger } from '../../utils/logger.js';

export const LEVEL_UP_CHANNEL_ID = '1530876981086785575';

export const LEVEL_MILESTONES = {
    5: {
        roleName: 'Lost Soul',
        souls: 500,
        shards: 5
    },
    10: {
        roleName: 'Shadow Walker',
        souls: 1000,
        shards: 10
    },
    20: {
        roleName: "Devil's Pawn",
        souls: 2000,
        shards: 20
    },
    30: {
        roleName: 'Abyss Hunter',
        souls: 3000,
        shards: 30
    },
    40: {
        roleName: 'Hell Maker',
        souls: 4000,
        shards: 40
    },
    50: {
        roleName: 'Void Reaper',
        souls: 5000,
        shards: 50
    },
    75: {
        roleName: 'Hollow Lord',
        souls: 7500,
        shards: 75
    },
    100: {
        roleName: 'Hollow Legend',
        souls: 10000,
        shards: 100
    }
};

function findRole(guild, roleName) {
    const normalizeRoleName = (name) =>
        name.replace(/\s*\(lvl\s*\d+\)\s*$/i, '').trim().toLowerCase();

    const normalizedTarget = normalizeRoleName(roleName);

    return guild.roles.cache.find(
        role => normalizeRoleName(role.name) === normalizedTarget
    ) || null;
}

export async function sendLevelUpNotification(guild, member, newLevel) {
    try {
        const channel = guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);

        if (!channel || !channel.isTextBased()) {
            logger.warn(`[Leveling] Level-up channel ${LEVEL_UP_CHANNEL_ID} not found or is not text based.`);
            return false;
        }

        const image = await createLevelUpImage(member, newLevel);
        const attachment = new AttachmentBuilder(image, { name: 'level-up.png' });

        await channel.send({
            content: `🎉 <@${member.id}> just reached **Level ${newLevel}!**`,
            files: [attachment]
        });

        return true;
    } catch (error) {
        logger.error('[Leveling] Failed to send level-up notification:', error);
        return false;
    }
}

async function giveSouls(client, guildId, userId, amount) {
    const economyData = await getEconomyData(client, guildId, userId);

    if (!economyData) {
        throw new Error('Economy data could not be loaded.');
    }

    economyData.wallet = Math.max(0, Number(economyData.wallet) || 0) + amount;

    await setEconomyData(client, guildId, userId, economyData);
}

async function giveShards(client, guildId, userId, amount) {
    const economyData = await getEconomyData(client, guildId, userId);

    if (!economyData) {
        throw new Error('Economy data could not be loaded.');
    }

    economyData.shards = Math.max(0, Number(economyData.shards) || 0) + amount;

    await setEconomyData(client, guildId, userId, economyData);
}

export function getCrossedMilestones(oldLevel, newLevel) {
    return Object.keys(LEVEL_MILESTONES)
        .map(Number)
        .filter(level => level > oldLevel && level <= newLevel)
        .sort((a, b) => a - b);
}

export async function processMilestoneReward(
    client,
    guild,
    member,
    userData,
    milestoneLevel
) {
    const reward = LEVEL_MILESTONES[milestoneLevel];

    if (!reward) return null;

    if (
        userData.milestoneRewards &&
        userData.milestoneRewards[String(milestoneLevel)]
    ) {
        return {
            level: milestoneLevel,
            alreadyClaimed: true,
            roleName: reward.roleName,
            souls: reward.souls,
            shards: reward.shards
        };
    }

    const role = findRole(guild, reward.roleName);

    if (!role) {
        logger.warn(`[Leveling] Milestone role "${reward.roleName}" not found.`);
        return {
            level: milestoneLevel,
            roleMissing: true,
            roleName: reward.roleName,
            souls: reward.souls,
            shards: reward.shards
        };
    }

    if (!member.roles.cache.has(role.id)) {
        try {
            await member.roles.add(role, `Level ${milestoneLevel} milestone reward`);
        } catch (error) {
            logger.error(`[Leveling] Failed to give role "${role.name}" to ${member.user.tag}:`, error);
            return {
                level: milestoneLevel,
                roleFailed: true,
                roleName: reward.roleName,
                souls: reward.souls,
                shards: reward.shards
            };
        }
    }

    try {
        await giveSouls(client, guild.id, member.id, reward.souls);
        await giveShards(client, guild.id, member.id, reward.shards);
    } catch (error) {
        logger.error(`[Leveling] Failed to give milestone currency to ${member.user.tag}:`, error);
        return {
            level: milestoneLevel,
            currencyFailed: true,
            roleGiven: true,
            roleName: reward.roleName,
            souls: reward.souls,
            shards: reward.shards
        };
    }

    if (!userData.milestoneRewards) userData.milestoneRewards = {};

    userData.milestoneRewards[String(milestoneLevel)] = true;

    return {
        level: milestoneLevel,
        rewarded: true,
        roleName: reward.roleName,
        souls: reward.souls,
        shards: reward.shards
    };
}

export async function processMilestoneRewards(
    client,
    guild,
    member,
    userData,
    oldLevel,
    newLevel
) {
    const milestones = getCrossedMilestones(oldLevel, newLevel);

    if (milestones.length === 0) return [];

    const results = [];

    for (const milestoneLevel of milestones) {
        const result = await processMilestoneReward(
            client,
            guild,
            member,
            userData,
            milestoneLevel
        );

        if (result) results.push(result);
    }

    return results;
}

export async function handleLevelUpRewards(
    client,
    guild,
    member,
    userData,
    oldLevel,
    newLevel
) {
    if (!guild || !member || newLevel <= oldLevel) {
        return { notified: false, milestones: [] };
    }

    const notified = await sendLevelUpNotification(guild, member, newLevel);

    const milestones = await processMilestoneRewards(
        client,
        guild,
        member,
        userData,
        oldLevel,
        newLevel
    );

    return { notified, milestones };
}
