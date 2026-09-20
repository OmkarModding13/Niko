import { ChannelType, PermissionFlagsBits } from 'discord.js';

import {
    getJoinToCreateConfig,
    registerTemporaryChannel,
    unregisterTemporaryChannel,
    getTemporaryChannelInfo,
    formatChannelName
} from '../utils/database.js';

import { sanitizeInput } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import { handleMusicVoiceState } from '../services/music/musicVoiceState.js';

import {
    getLevelingConfig
} from '../services/leveling/leveling.js';

import {
    addVoiceMinutes
} from '../services/leveling/xpSystem.js';

const channelCreationCooldown = new Map();

const VOICE_CREATE_COOLDOWN_MS = 2000;

const DEFAULT_VOICE_BITRATE = 64000;
const MAX_VOICE_BITRATE = 384000;
const MIN_VOICE_BITRATE = 8000;

const MAX_CHANNEL_NAME_LENGTH = 100;
const FALLBACK_CHANNEL_NAME = 'Voice Room';

const MAX_TRACKED_COOLDOWNS = 10000;

// Existing server trigger channel previously handled by another bot.
const EXISTING_JTC_TRIGGER_CHANNEL_ID = '1536728008600068156';

/*
 * ==================================================
 * LEVELING VOICE SESSIONS
 * ==================================================
 *
 * Stores when a user entered an eligible voice channel.
 *
 * This is intentionally only session state.
 * Actual accumulated progress is saved in PostgreSQL
 * through the leveling service.
 */

const voiceSessions = new Map();

/*
 * ==================================================
 * MAIN EVENT
 * ==================================================
 */

export default {
    name: 'voiceStateUpdate',

    async execute(oldState, newState, client) {
        if (!newState.member?.user) {
            return;
        }

        if (newState.member.user.bot) {
            return;
        }

        const guildId =
            newState.guild.id;

        const userId =
            newState.member.id;

        const cooldownKey =
            `${guildId}-${userId}`;

        cleanupCooldownEntries();

        try {
            /*
             * ------------------------------------------
             * LEVELING VOICE TRACKING
             * ------------------------------------------
             */

            await handleLevelingVoiceState(
                oldState,
                newState,
                client
            );

            /*
             * ------------------------------------------
             * JOIN TO CREATE
             * ------------------------------------------
             */

            const config =
                await getJoinToCreateConfig(
                    client,
                    guildId
                );

            // Adopt the existing trigger channel instead of creating a second one.
            if (
                newState.channel?.id === EXISTING_JTC_TRIGGER_CHANNEL_ID &&
                !config.triggerChannels.includes(EXISTING_JTC_TRIGGER_CHANNEL_ID)
            ) {
                const triggerChannel = newState.guild.channels.cache.get(EXISTING_JTC_TRIGGER_CHANNEL_ID);

                if (triggerChannel?.type === ChannelType.GuildVoice) {
                    config.triggerChannels.push(EXISTING_JTC_TRIGGER_CHANNEL_ID);
                    config.enabled = true;
                    config.channelOptions = config.channelOptions || {};
                    config.channelOptions[EXISTING_JTC_TRIGGER_CHANNEL_ID] = {
                        ...(config.channelOptions[EXISTING_JTC_TRIGGER_CHANNEL_ID] || {}),
                        nameTemplate: config.channelOptions[EXISTING_JTC_TRIGGER_CHANNEL_ID]?.nameTemplate || "{username}'s Room",
                        userLimit: config.channelOptions[EXISTING_JTC_TRIGGER_CHANNEL_ID]?.userLimit ?? 0,
                        bitrate: config.channelOptions[EXISTING_JTC_TRIGGER_CHANNEL_ID]?.bitrate ?? DEFAULT_VOICE_BITRATE,
                        categoryId: triggerChannel.parentId || null
                    };

                    await client.db.set("guild:" + guildId + ":jointocreate", config);
                    logger.info("Adopted existing Join to Create trigger " + EXISTING_JTC_TRIGGER_CHANNEL_ID + " for guild " + guildId);
                }
            }

            if (
                !config.enabled ||
                config.triggerChannels.length === 0
            ) {
                /*
                 * Music still needs to receive
                 * voice state changes.
                 */
                if (client.config?.features?.music) {
                    handleMusicVoiceState(
                        client,
                        oldState,
                        newState
                    ).catch(error => {
                        logger.error(
                            'Music voice state handler error:',
                            error
                        );
                    });
                }

                return;
            }

            /*
             * User joined a voice channel
             */
            if (
                !oldState.channel &&
                newState.channel
            ) {
                await handleVoiceJoin(
                    client,
                    newState,
                    config,
                    cooldownKey
                );
            }

            /*
             * User left voice
             */
            if (
                oldState.channel &&
                !newState.channel
            ) {
                await handleVoiceLeave(
                    client,
                    oldState,
                    config
                );
            }

            /*
             * User moved between voice channels
             */
            if (
                oldState.channel &&
                newState.channel &&
                oldState.channel.id !==
                    newState.channel.id
            ) {
                await handleVoiceMove(
                    client,
                    oldState,
                    newState,
                    config,
                    cooldownKey
                );
            }

        } catch (error) {
            logger.error(
                `Error in voiceStateUpdate for guild ${guildId}:`,
                error
            );
        }

        /*
         * Music handler should always receive
         * the voice state update.
         */
        if (
            client.config?.features?.music
        ) {
            handleMusicVoiceState(
                client,
                oldState,
                newState
            ).catch(error => {
                logger.error(
                    'Music voice state handler error:',
                    error
                );
            });
        }
    }
};

/*
 * ==================================================
 * LEVELING VOICE TRACKER
 * ==================================================
 */

async function handleLevelingVoiceState(
    oldState,
    newState,
    client
) {
    try {
        const guild =
            newState.guild;

        const member =
            newState.member;

        if (
            !guild ||
            !member ||
            member.user.bot
        ) {
            return;
        }

        const guildId =
            guild.id;

        const userId =
            member.id;

        const sessionKey =
            `${guildId}:${userId}`;

        const config =
            await getLevelingConfig(
                client,
                guildId
            );

        if (!config?.enabled) {
            return;
        }

        /*
         * Ignore users with ignored roles.
         */
        if (
            config.ignoredRoles?.length > 0 &&
            member.roles.cache.some(role =>
                config.ignoredRoles.includes(
                    role.id
                )
            )
        ) {
            await finishVoiceSession(
                client,
                guildId,
                userId,
                sessionKey
            );

            return;
        }

        /*
         * Ignore blacklisted users.
         */
        if (
            config.blacklistedUsers?.includes(
                userId
            )
        ) {
            await finishVoiceSession(
                client,
                guildId,
                userId,
                sessionKey
            );

            return;
        }

        /*
         * Determine whether the user is
         * currently eligible for leveling.
         */
        const eligible =
            isEligibleVoiceState(
                newState
            );

        /*
         * ------------------------------------------
         * USER LEFT VOICE
         * ------------------------------------------
         */

        if (
            oldState.channel &&
            !newState.channel
        ) {
            await finishVoiceSession(
                client,
                guildId,
                userId,
                sessionKey
            );

            return;
        }

        /*
         * ------------------------------------------
         * USER JOINED VOICE
         * ------------------------------------------
         */

        if (
            !oldState.channel &&
            newState.channel
        ) {
            if (eligible) {
                startVoiceSession(
                    sessionKey
                );
            }

            return;
        }

        /*
         * ------------------------------------------
         * USER MOVED CHANNEL
         * ------------------------------------------
         */

        if (
            oldState.channel &&
            newState.channel &&
            oldState.channel.id !==
                newState.channel.id
        ) {
            /*
             * Finish previous session first.
             */
            await finishVoiceSession(
                client,
                guildId,
                userId,
                sessionKey
            );

            /*
             * Start new session only if
             * destination is eligible.
             */
            if (eligible) {
                startVoiceSession(
                    sessionKey
                );
            }

            return;
        }

        /*
         * ------------------------------------------
         * MUTE / DEAF / STREAM / VIDEO CHANGES
         * ------------------------------------------
         */

        if (oldState.channel && newState.channel) {
            const wasEligible =
                isEligibleVoiceState(
                    oldState
                );

            const isNowEligible =
                isEligibleVoiceState(
                    newState
                );

            /*
             * Became eligible
             */
            if (
                !wasEligible &&
                isNowEligible
            ) {
                startVoiceSession(
                    sessionKey
                );

                return;
            }

            /*
             * Became ineligible
             */
            if (
                wasEligible &&
                !isNowEligible
            ) {
                await finishVoiceSession(
                    client,
                    guildId,
                    userId,
                    sessionKey
                );

                return;
            }
        }

    } catch (error) {
        logger.error(
            'Error handling leveling voice state:',
            error
        );
    }
}

/*
 * ==================================================
 * VOICE ELIGIBILITY
 * ==================================================
 */

function isEligibleVoiceState(
    state
) {
    const channel =
        state.channel;

    const member =
        state.member;

    if (
        !channel ||
        !member
    ) {
        return false;
    }

    /*
     * Only normal voice channels.
     */
    if (
        channel.type !==
        ChannelType.GuildVoice
    ) {
        return false;
    }

    /*
     * User must not be self-muted.
     */
    if (state.selfMute) {
        return false;
    }

    /*
     * User must not be self-deafened.
     */
    if (state.selfDeaf) {
        return false;
    }

    /*
     * We need at least 2 non-bot members
     * in the voice channel.
     */
    const humanMembers =
        channel.members.filter(
            channelMember =>
                !channelMember.user.bot
        );

    if (
        humanMembers.size < 2
    ) {
        return false;
    }

    return true;
}

/*
 * ==================================================
 * START VOICE SESSION
 * ==================================================
 */

function startVoiceSession(
    sessionKey
) {
    if (
        voiceSessions.has(
            sessionKey
        )
    ) {
        return;
    }

    voiceSessions.set(
        sessionKey,
        Date.now()
    );

    logger.debug(
        `🎙️ Started leveling voice session: ${sessionKey}`
    );
}

/*
 * ==================================================
 * FINISH VOICE SESSION
 * ==================================================
 */

async function finishVoiceSession(
    client,
    guildId,
    userId,
    sessionKey
) {
    const startTime =
        voiceSessions.get(
            sessionKey
        );

    if (!startTime) {
        return;
    }

    voiceSessions.delete(
        sessionKey
    );

    const elapsedMs =
        Date.now() - startTime;

    /*
     * Convert milliseconds to minutes.
     *
     * We only save complete minutes.
     */
    const elapsedMinutes =
        Math.floor(
            elapsedMs / 60000
        );

    if (
        elapsedMinutes <= 0
    ) {
        return;
    }

    /*
     * Save activity to PostgreSQL.
     */
    await addVoiceMinutes(
        client,
        guildId,
        userId,
        elapsedMinutes
    );

    logger.debug(
        `🎙️ Recorded ${elapsedMinutes} minutes of voice activity for ${userId}`
    );
}

/*
 * ==================================================
 * JOIN TO CREATE
 * ==================================================
 */

async function handleVoiceJoin(
    client,
    state,
    config,
    cooldownKey
) {
    const {
        channel,
        member
    } = state;

    if (
        !config.triggerChannels.includes(
            channel.id
        )
    ) {
        return;
    }

    const now =
        Date.now();

    if (
        channelCreationCooldown.has(
            cooldownKey
        )
    ) {
        const lastCreation =
            channelCreationCooldown.get(
                cooldownKey
            );

        if (
            now - lastCreation <
            VOICE_CREATE_COOLDOWN_MS
        ) {
            logger.warn(
                `User ${member.id} is on cooldown for channel creation`
            );

            return;
        }
    }

    const existingTempChannel =
        Object.keys(
            config.temporaryChannels || {}
        ).find(
            tempChannelId => {
                const tempInfo =
                    config.temporaryChannels[
                        tempChannelId
                    ];

                return (
                    tempInfo &&
                    tempInfo.ownerId ===
                        member.id
                );
            }
        );

    if (existingTempChannel) {
        const tempChannel =
            state.guild.channels.cache.get(
                existingTempChannel
            );

        if (tempChannel) {
            try {
                await member.voice.setChannel(
                    tempChannel
                );

                return;
            } catch (error) {
                logger.warn(
                    `Failed to move user ${member.id} to existing channel ${existingTempChannel}:`,
                    error
                );
            }
        }
    }

    if (
        member.voice.channel?.id !==
        channel.id
    ) {
        return;
    }

    channelCreationCooldown.set(
        cooldownKey,
        now
    );

    trimCooldownMapIfNeeded();

    await createTemporaryChannel(
        client,
        state,
        config,
        cooldownKey
    );
}

/*
 * ==================================================
 * VOICE LEAVE
 * ==================================================
 */

async function handleVoiceLeave(
    client,
    state,
    config
) {
    const {
        channel,
        member
    } = state;

    const tempChannelInfo =
        await getTemporaryChannelInfo(
            client,
            state.guild.id,
            channel.id
        );

    if (!tempChannelInfo) {
        return;
    }

    if (
        channel.members.size === 0
    ) {
        await deleteTemporaryChannel(
            client,
            channel,
            state.guild.id
        );
    } else if (
        tempChannelInfo.ownerId ===
        member.id
    ) {
        const nextMember =
            channel.members.first();

        if (nextMember) {
            await transferChannelOwnership(
                client,
                channel,
                state.guild.id,
                nextMember.id
            );
        }
    }
}

/*
 * ==================================================
 * VOICE MOVE
 * ==================================================
 */

async function handleVoiceMove(
    client,
    oldState,
    newState,
    config,
    cooldownKey
) {
    if (oldState.channel) {
        const tempChannelInfo =
            await getTemporaryChannelInfo(
                client,
                oldState.guild.id,
                oldState.channel.id
            );

        if (tempChannelInfo) {
            if (
                oldState.channel.members.size ===
                0
            ) {
                await deleteTemporaryChannel(
                    client,
                    oldState.channel,
                    oldState.guild.id
                );
            } else if (
                tempChannelInfo.ownerId ===
                oldState.member.id
            ) {
                const nextMember =
                    oldState.channel.members.first();

                if (nextMember) {
                    await transferChannelOwnership(
                        client,
                        oldState.channel,
                        oldState.guild.id,
                        nextMember.id
                    );
                }
            }
        }
    }

    if (
        config.triggerChannels.includes(
            newState.channel.id
        ) &&
        !config.triggerChannels.includes(
            oldState.channel?.id
        )
    ) {
        await handleVoiceJoin(
            client,
            newState,
            config,
            cooldownKey
        );
    }
}

/*
 * ==================================================
 * CREATE TEMPORARY CHANNEL
 * ==================================================
 */

async function createTemporaryChannel(
    client,
    state,
    config,
    cooldownKey
) {
    const {
        channel: triggerChannel,
        member,
        guild
    } = state;

    try {
        const me =
            guild.members.me;

        if (!me) {
            logger.warn(
                `Bot member cache unavailable while creating temporary channel in guild ${guild.id}`
            );

            channelCreationCooldown.delete(
                cooldownKey
            );

            return;
        }

        const triggerPermissions =
            triggerChannel.permissionsFor(
                me
            );

        if (
            !triggerPermissions?.has([
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.Connect
            ])
        ) {
            logger.warn(
                `Missing required permissions for temporary channel creation in guild ${guild.id} (trigger channel ${triggerChannel.id})`
            );

            channelCreationCooldown.delete(
                cooldownKey
            );

            return;
        }

        const channelOptions =
            config.channelOptions?.[
                triggerChannel.id
            ] || {};

        const nameTemplate =
            channelOptions.nameTemplate ||
            config.channelNameTemplate ||
            "{username}'s Room";

        let userLimit =
            channelOptions.userLimit ??
            config.userLimit ??
            0;

        const bitrate =
            clampVoiceBitrate(
                channelOptions.bitrate ??
                config.bitrate ??
                DEFAULT_VOICE_BITRATE
            );

        userLimit =
            Math.max(
                0,
                Math.min(
                    99,
                    userLimit || 0
                )
            );

        logger.info(
            `Creating temporary channel for user ${member.id} with user limit: ${userLimit}`
        );

        const existingChannels =
            guild.channels.cache.filter(
                channel =>
                    channel.parentId ===
                        triggerChannel.parentId &&
                    channel.name.startsWith(
                        triggerChannel.name
                    )
            ).size;

        let finalName;

        if (
            nameTemplate.includes(
                '{username}'
            ) ||
            nameTemplate.includes(
                '{displayName}'
            )
        ) {
            finalName =
                formatChannelName(
                    nameTemplate,
                    {
                        username:
                            member.user.username,

                        userTag:
                            member.user.tag,

                        displayName:
                            member.displayName,

                        guildName:
                            guild.name,

                        channelName:
                            triggerChannel.name
                    }
                );
        } else {
            finalName =
                `${triggerChannel.name} ${existingChannels + 1}`;
        }

        const channelName =
            sanitizeVoiceChannelName(
                finalName
            );

        if (
            !member.voice?.channel ||
            member.voice.channel.id !==
                triggerChannel.id
        ) {
            logger.debug(
                `Member ${member.id} no longer in trigger channel ${triggerChannel.id}, aborting temporary channel creation`
            );

            channelCreationCooldown.delete(
                cooldownKey
            );

            return;
        }

        const tempChannel =
            await guild.channels.create({
                name: channelName,

                type:
                    ChannelType.GuildVoice,

                parent:
                    triggerChannel.parentId,

                userLimit:
                    userLimit === 0
                        ? undefined
                        : userLimit,

                bitrate,

                permissionOverwrites: [
                    {
                        id: member.id,

                        allow: [
                            'Connect',
                            'Speak',
                            'PrioritySpeaker',
                            'MoveMembers'
                        ]
                    },

                    {
                        id: guild.id,

                        allow: [
                            'Connect',
                            'Speak'
                        ]
                    }
                ]
            });

        await registerTemporaryChannel(
            client,
            guild.id,
            tempChannel.id,
            member.id,
            triggerChannel.id
        );

        if (
            member.voice?.channel?.id ===
            triggerChannel.id
        ) {
            await member.voice.setChannel(
                tempChannel
            );
        } else {
            logger.debug(
                `Skipped moving ${member.id} to temporary channel ${tempChannel.id} because voice state changed`
            );
        }

        logger.info(
            `Created temporary voice channel ${tempChannel.name} (${tempChannel.id}) for user ${member.user.tag} in guild ${guild.name} with user limit ${userLimit}`
        );

    } catch (error) {
        logger.error(
            `Failed to create temporary channel for user ${member.user.tag} in guild ${guild.name}:`,
            error
        );

        channelCreationCooldown.delete(
            cooldownKey
        );

        try {
            await member.send({
                content:
                    '❌ Failed to create your temporary voice channel. Please contact a server administrator.'
            });
        } catch (dmError) {
            logger.debug(
                `Unable to send temporary channel failure DM to user ${member.id}:`,
                dmError
            );
        }
    }
}

/*
 * ==================================================
 * DELETE TEMP CHANNEL
 * ==================================================
 */

async function deleteTemporaryChannel(
    client,
    channel,
    guildId
) {
    try {
        await unregisterTemporaryChannel(
            client,
            guildId,
            channel.id
        );

        await channel.delete(
            'Temporary voice channel - empty'
        );

        logger.info(
            `Deleted temporary voice channel ${channel.name} (${channel.id}) in guild ${channel.guild.name}`
        );

    } catch (error) {
        logger.error(
            `Failed to delete temporary channel ${channel.id}:`,
            error
        );
    }
}

/*
 * ==================================================
 * TRANSFER OWNERSHIP
 * ==================================================
 */

async function transferChannelOwnership(
    client,
    channel,
    guildId,
    newOwnerId
) {
    try {
        const config =
            await getJoinToCreateConfig(
                client,
                guildId
            );

        const tempChannelInfo =
            config.temporaryChannels[
                channel.id
            ];

        if (!tempChannelInfo) {
            return;
        }

        config.temporaryChannels[
            channel.id
        ].ownerId =
            newOwnerId;

        await client.db.set(
            `guild:${guildId}:jointocreate`,
            config
        );

        const newOwner =
            await channel.guild.members.fetch(
                newOwnerId
            );

        if (newOwner) {
            const channelOptions =
                config.channelOptions?.[
                    tempChannelInfo.triggerChannelId
                ] || {};

            const nameTemplate =
                channelOptions.nameTemplate ||
                config.channelNameTemplate;

            const newChannelName =
                sanitizeVoiceChannelName(
                    formatChannelName(
                        nameTemplate,
                        {
                            username:
                                newOwner.user.username,

                            userTag:
                                newOwner.user.tag,

                            displayName:
                                newOwner.displayName,

                            guildName:
                                channel.guild.name,

                            channelName:
                                channel.guild.channels.cache.get(
                                    tempChannelInfo.triggerChannelId
                                )?.name ||
                                'Voice Channel'
                        }
                    )
                );

            await channel.setName(
                newChannelName
            );
        }

        logger.info(
            `Transferred ownership of channel ${channel.id} to user ${newOwnerId}`
        );

    } catch (error) {
        logger.error(
            `Failed to transfer ownership of channel ${channel.id}:`,
            error
        );
    }
}

/*
 * ==================================================
 * SANITIZE CHANNEL NAME
 * ==================================================
 */

function sanitizeVoiceChannelName(
    inputName
) {
    const safeName =
        sanitizeInput(
            String(inputName || ''),
            MAX_CHANNEL_NAME_LENGTH
        )
            .replace(
                /[\r\n\t]/g,
                ' '
            )
            .replace(
                /\s+/g,
                ' '
            )
            .trim();

    return (
        safeName ||
        FALLBACK_CHANNEL_NAME
    );
}

/*
 * ==================================================
 * VOICE BITRATE
 * ==================================================
 */

function clampVoiceBitrate(
    value
) {
    const parsed =
        Number(value);

    if (
        !Number.isFinite(parsed)
    ) {
        return DEFAULT_VOICE_BITRATE;
    }

    return Math.max(
        MIN_VOICE_BITRATE,
        Math.min(
            MAX_VOICE_BITRATE,
            Math.floor(parsed)
        )
    );
}

/*
 * ==================================================
 * CLEANUP COOLDOWNS
 * ==================================================
 */

function cleanupCooldownEntries() {
    const now =
        Date.now();

    for (
        const [
            key,
            timestamp
        ]
        of channelCreationCooldown.entries()
    ) {
        if (
            now - timestamp >=
            VOICE_CREATE_COOLDOWN_MS
        ) {
            channelCreationCooldown.delete(
                key
            );
        }
    }
}

function trimCooldownMapIfNeeded() {
    if (
        channelCreationCooldown.size <=
        MAX_TRACKED_COOLDOWNS
    ) {
        return;
    }

    const entries =
        [
            ...channelCreationCooldown.entries()
        ].sort(
            (a, b) =>
                a[1] - b[1]
        );

    const removeCount =
        channelCreationCooldown.size -
        MAX_TRACKED_COOLDOWNS;

    for (
        let index = 0;
        index < removeCount;
        index += 1
    ) {
        channelCreationCooldown.delete(
            entries[index][0]
        );
    }
}
