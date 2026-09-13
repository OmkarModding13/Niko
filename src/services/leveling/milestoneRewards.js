import { AttachmentBuilder } from 'discord.js';

import {
    getEconomyData,
    setEconomyData
} from '../../utils/economy.js';

import {
    createLevelUpImage
} from './levelUpImage.js';

import { logger } from '../../utils/logger.js';


// ==================================================
// LEVEL-UP CHANNEL
// ==================================================

export const LEVEL_UP_CHANNEL_ID =
    '1530876981086785575';


// ==================================================
// MILESTONE REWARDS
// ==================================================

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
        roleName: "Devil's Pawn",
        souls: 2000
    },

    30: {
        roleName: 'Abyss Hunter',
        souls: 3000
    },

    40: {
        roleName: 'Hell Maker',
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


// ==================================================
// FIND ROLE
// ==================================================

function findRole(guild, roleName) {

    return guild.roles.cache.find(
        role =>
            role.name.toLowerCase() ===
            roleName.toLowerCase()
    ) || null;

}


// ==================================================
// SEND LEVEL-UP IMAGE
// ==================================================

export async function sendLevelUpNotification(
    guild,
    member,
    newLevel
) {

    try {

        const channel =
            guild.channels.cache.get(
                LEVEL_UP_CHANNEL_ID
            );


        if (!channel) {

            logger.warn(
                `[Leveling] Level-up channel ${LEVEL_UP_CHANNEL_ID} not found.`
            );

            return false;

        }


        if (!channel.isTextBased()) {

            logger.warn(
                `[Leveling] Level-up channel ${LEVEL_UP_CHANNEL_ID} is not text based.`
            );

            return false;

        }


        const image =
            await createLevelUpImage(
                member,
                newLevel
            );


        const attachment =
            new AttachmentBuilder(
                image,
                {
                    name: 'level-up.png'
                }
            );


        await channel.send({

            content:
                `🎉 <@${member.id}> just reached **Level ${newLevel}!**`,

            files: [
                attachment
            ]

        });


        return true;

    } catch (error) {

        logger.error(
            `[Leveling] Failed to send level-up notification:`,
            error
        );

        return false;

    }

}


// ==================================================
// GIVE SOULS
// ==================================================

async function giveSouls(
    client,
    guildId,
    userId,
    amount
) {

    const economyData =
        await getEconomyData(
            client,
            guildId,
            userId
        );


    if (!economyData) {

        throw new Error(
            'Economy data could not be loaded.'
        );

    }


    economyData.wallet =
        Math.max(
            0,
            Number(
                economyData.wallet
            ) || 0
        ) + amount;


    await setEconomyData(
        client,
        guildId,
        userId,
        economyData
    );

}


// ==================================================
// GET CROSSSED MILESTONES
// ==================================================

export function getCrossedMilestones(
    oldLevel,
    newLevel
) {

    return Object.keys(
        LEVEL_MILESTONES
    )

        .map(Number)

        .filter(
            level =>
                level > oldLevel &&
                level <= newLevel
        )

        .sort(
            (a, b) => a - b
        );

}


// ==================================================
// PROCESS MILESTONE
// ==================================================

export async function processMilestoneReward(
    client,
    guild,
    member,
    userData,
    milestoneLevel
) {

    const reward =
        LEVEL_MILESTONES[
            milestoneLevel
        ];


    if (!reward) {

        return null;

    }


    // ----------------------------------------------
    // ONE-TIME CHECK
    // ----------------------------------------------

    if (
        userData.milestoneRewards &&
        userData.milestoneRewards[
            String(milestoneLevel)
        ]
    ) {

        return {
            level: milestoneLevel,
            alreadyClaimed: true,
            roleName: reward.roleName,
            souls: reward.souls
        };

    }


    // ----------------------------------------------
    // FIND ROLE
    // ----------------------------------------------

    const role =
        findRole(
            guild,
            reward.roleName
        );


    if (!role) {

        logger.warn(
            `[Leveling] Milestone role "${reward.roleName}" not found.`
        );

        /*
         * Do NOT mark as claimed.
         *
         * This allows the reward to be retried
         * after the role is created.
         */

        return {
            level: milestoneLevel,
            roleMissing: true,
            roleName: reward.roleName,
            souls: reward.souls
        };

    }


    // ----------------------------------------------
    // GIVE ROLE
    // ----------------------------------------------

    if (
        !member.roles.cache.has(
            role.id
        )
    ) {

        try {

            await member.roles.add(
                role,
                `Level ${milestoneLevel} milestone reward`
            );

        } catch (error) {

            logger.error(
                `[Leveling] Failed to give role "${role.name}" to ${member.user.tag}:`,
                error
            );

            return {
                level: milestoneLevel,
                roleFailed: true,
                roleName: reward.roleName,
                souls: reward.souls
            };

        }

    }


    // ----------------------------------------------
    // GIVE SOULS
    // ----------------------------------------------

    try {

        await giveSouls(
            client,
            guild.id,
            member.id,
            reward.souls
        );

    } catch (error) {

        logger.error(
            `[Leveling] Failed to give ${reward.souls} Souls to ${member.user.tag}:`,
            error
        );

        return {
            level: milestoneLevel,
            soulsFailed: true,
            roleGiven: true,
            roleName: reward.roleName,
            souls: reward.souls
        };

    }


    // ----------------------------------------------
    // PERMANENT CLAIM RECORD
    // ----------------------------------------------

    if (!userData.milestoneRewards) {

        userData.milestoneRewards =
            {};

    }


    userData.milestoneRewards[
        String(milestoneLevel)
    ] = true;


    return {
        level: milestoneLevel,
        rewarded: true,
        roleName: reward.roleName,
        souls: reward.souls
    };

}


// ==================================================
// PROCESS ALL MILESTONES
// ==================================================

export async function processMilestoneRewards(
    client,
    guild,
    member,
    userData,
    oldLevel,
    newLevel
) {

    const milestones =
        getCrossedMilestones(
            oldLevel,
            newLevel
        );


    if (
        milestones.length === 0
    ) {

        return [];

    }


    const results = [];


    for (
        const milestoneLevel
        of milestones
    ) {

        const result =
            await processMilestoneReward(
                client,
                guild,
                member,
                userData,
                milestoneLevel
            );


        if (result) {

            results.push(
                result
            );

        }

    }


    return results;

}


// ==================================================
// HANDLE COMPLETE LEVEL-UP
// ==================================================

export async function handleLevelUpRewards(
    client,
    guild,
    member,
    userData,
    oldLevel,
    newLevel
) {

    if (
        !guild ||
        !member ||
        newLevel <= oldLevel
    ) {

        return {
            notified: false,
            milestones: []
        };

    }


    // ----------------------------------------------
    // 1. LEVEL-UP NOTIFICATION
    // ----------------------------------------------

    const notified =
        await sendLevelUpNotification(
            guild,
            member,
            newLevel
        );


    // ----------------------------------------------
    // 2. MILESTONE REWARDS
    // ----------------------------------------------

    const milestones =
        await processMilestoneRewards(
            client,
            guild,
            member,
            userData,
            oldLevel,
            newLevel
        );


    return {
        notified,
        milestones
    };

}
