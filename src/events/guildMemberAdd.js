// Dynamic welcome banner enabled
// Railway auto deploy test
import { Events, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getWelcomeConfig } from '../utils/database.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { getServerCounters, updateCounter } from '../services/serverstatsService.js';
import { setBirthday as dbSetBirthday } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { generateWelcomeImage } from '../utils/welcomeImage.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,
  
  async execute(member) {
    try {
        const { guild, user } = member;
        
        // Welcome delivery must not be blocked by unrelated guild-config failures.
        let config = null;
        let welcomeConfig = null;
        try {
            welcomeConfig = await getWelcomeConfig(member.client, guild.id);
        } catch (error) {
            logger.error('[Welcome] Could not load welcome settings', {
                guildId: guild.id,
                error: error.message,
            });
        }
        try {
            config = await getGuildConfig(member.client, guild.id);
        } catch (error) {
            logger.error('[Welcome] Could not load guild settings; continuing join pipeline', {
                guildId: guild.id,
                error: error.message,
            });
        }

        const configuredChannelId = welcomeConfig?.channelId || null;
        let configuredChannel = null;
        if (configuredChannelId) {
            configuredChannel = guild.channels.cache.get(configuredChannelId)
                || await guild.channels.fetch(configuredChannelId).catch((error) => {
                    logger.error('[Welcome] Configured channel could not be fetched; trying fallback channels', {
                        guildId: guild.id,
                        channelId: configuredChannelId,
                        error: error.message,
                    });
                    return null;
                });
        }

        const botMember = guild.members.me || await guild.members.fetchMe().catch((error) => {
            logger.error('[Welcome] Could not fetch bot member for permission checks', {
                guildId: guild.id,
                error: error.message,
            });
            return null;
        });

        const fallbackCandidates = [
            findWelcomeChannel(guild, ['welcome']),
            findWelcomeChannel(guild, ['new-member']),
            findWelcomeChannel(guild, ['arrival']),
            guild.systemChannel || (guild.systemChannelId ? guild.channels.cache.get(guild.systemChannelId) : null),
            findWelcomeChannel(guild, ['general']),
            findWelcomeChannel(guild, ['chat']),
        ];
        const candidates = [configuredChannel, ...fallbackCandidates]
            .filter((channel, index, all) => channel && all.indexOf(channel) === index);

        let channel = null;
        let permissions = null;
        const unavailableCandidates = [];

        for (const candidate of candidates) {
            if (!candidate?.isTextBased?.()) continue;
            const candidatePermissions = botMember ? candidate.permissionsFor(botMember) : null;
            const canView = candidatePermissions?.has(PermissionFlagsBits.ViewChannel) ?? false;
            const canSend = candidatePermissions?.has(PermissionFlagsBits.SendMessages) ?? false;
            if (canView && canSend) {
                channel = candidate;
                permissions = candidatePermissions;
                break;
            }
            unavailableCandidates.push({
                channelId: candidate.id,
                channelName: candidate.name,
                canView,
                canSend,
            });
        }

        logger.info('[Welcome] Member join received', {
            guildId: guild.id,
            guildName: guild.name,
            memberId: user.id,
            welcomeEnabled: Boolean(welcomeConfig?.enabled),
            configuredChannelId,
            selectedChannelId: channel?.id || null,
            selectedChannelName: channel?.name || null,
        });

        if (!channel) {
            logger.warn('[Welcome] Message not sent: no configured/system/welcome/general/chat channel allows Niko to send', {
                guildId: guild.id,
                welcomeEnabled: Boolean(welcomeConfig?.enabled),
                configuredChannelId,
                systemChannelId: guild.systemChannelId || null,
                unavailableCandidates,
            });
        } else {
            const usedFallback = !configuredChannel || channel.id !== configuredChannel.id;
            const rulesChannel = findWelcomeChannel(guild, ['rule', '𝚛𝚞𝚕𝚎', '𝚛𝚞𝚕𝚎𝚜']);
            const chatChannel = findWelcomeChannel(guild, ['chat', '𝚌𝚑𝚊𝚝']);
            const videoChannel = findWelcomeChannel(guild, ['video-notification', 'video notification']);
            const rolesChannel = findWelcomeChannel(guild, ['roles-info', 'roles info']);
            const welcomeMessage = buildWelcomeMessage(guild, user, {
                rulesChannel,
                chatChannel,
                videoChannel,
                rolesChannel,
            });

            let welcomeAttachment = null;
            const backgroundUrl = welcomeConfig?.welcomeImage || welcomeConfig?.welcomeEmbed?.image?.url || null;
            const canAttachFiles = permissions.has(PermissionFlagsBits.AttachFiles);
            if (canAttachFiles) {
                try {
                    const imageBuffer = await generateWelcomeImage({
                        backgroundUrl,
                        avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
                        username: user.username,
                        memberCount: guild.memberCount,
                    });
                    welcomeAttachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
                    logger.info('[Welcome] Personalized banner generated', {
                        guildId: guild.id,
                        memberId: user.id,
                        memberCount: guild.memberCount,
                        customBackground: Boolean(backgroundUrl),
                    });
                } catch (error) {
                    logger.error('[Welcome] Failed to generate personalized banner', {
                        guildId: guild.id,
                        memberId: user.id,
                        error: error.message,
                    });
                }
            } else {
                logger.warn('[Welcome] Banner omitted because Niko lacks Attach Files permission', {
                    guildId: guild.id,
                    channelId: channel.id,
                    channelName: channel.name,
                });
            }

            try {
                await channel.send({
                    content: welcomeMessage,
                    files: welcomeAttachment ? [welcomeAttachment] : [],
                });
                logger.info('[Welcome] Message sent', {
                    guildId: guild.id,
                    channelId: channel.id,
                    channelName: channel.name,
                    usedFallback,
                });
            } catch (error) {
                logger.error('[Welcome] Failed to send message', {
                    guildId: guild.id,
                    channelId: channel.id,
                    channelName: channel.name,
                    error: error.message,
                });
            }
        }

        if (welcomeConfig?.roleIds && welcomeConfig.roleIds.length > 0) {
            const delay = welcomeConfig.autoRoleDelay || 0;
            const singleRoleId = welcomeConfig.roleIds[0];
            
            if (delay > 0) {
                const timeout = setTimeout(async () => {
                    const role = guild.roles.cache.get(singleRoleId);
                    if (role) {
                        await assignRoleSafely(member, role);
                    }
                }, delay * 1000);
                if (typeof timeout.unref === 'function') {
                    timeout.unref();
                }
            } else {
                const role = guild.roles.cache.get(singleRoleId);
                if (role) {
                    await assignRoleSafely(member, role);
                }
            }
        }
        
        if (config?.verification?.enabled || config?.verification?.autoVerify?.enabled) {
            await handleVerification(member, guild, config.verification, member.client);
        }

        try {
            await logEvent({
                client: member.client,
                guildId: guild.id,
                eventType: EVENT_TYPES.MEMBER_JOIN,
                data: {
                    title: 'User joined',
                    lines: [
                        `**User:** ${user.toString()} (${user.displayName !== user.username ? `@${user.displayName}` : user.tag})`,
                        `**ID:** \`${user.id}\``,
                        `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                        `**Members:** ${guild.memberCount}`,
                    ],
                    quoted: false,
                    thumbnail: user.displayAvatarURL({ dynamic: true }),
                    userId: user.id,
                }
            });
        } catch (error) {
            logger.debug('Error logging member join:', error);
        }

        try {
            const counters = await getServerCounters(member.client, guild.id);
            for (const counter of counters) {
                if (counter && counter.type && counter.channelId && counter.enabled !== false) {
                    await updateCounter(member.client, guild, counter);
                }
            }
        } catch (error) {
            logger.debug('Error updating counters on member join:', error);
        }

        try {
            const backupKey = `guild:${guild.id}:birthdays:left`;
            const backup = (await member.client.db.get(backupKey)) || {};
            if (backup[user.id]) {
                const { month, day } = backup[user.id];
                await dbSetBirthday(member.client, guild.id, user.id, month, day);
                delete backup[user.id];
                await member.client.db.set(backupKey, backup);
                logger.debug(`Birthday restored for user ${user.id} in guild ${guild.id}`);
            }
        } catch (error) {
            logger.debug('Error restoring birthday on member join:', error);
        }
        
    } catch (error) {
        logger.error('Error in guildMemberAdd event:', error);
    }
  }
};

function normalizeChannelName(name = '') {
    return String(name)
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[\\u0300-\\u036f]/g, '');
}

function findWelcomeChannel(guild, patterns = []) {
    const normalizedPatterns = patterns
        .map(pattern => normalizeChannelName(pattern))
        .filter(Boolean);

    return guild.channels.cache.find(channel => {
        if (!channel?.isTextBased?.()) {
            return false;
        }

        const name = normalizeChannelName(channel.name);
        return normalizedPatterns.some(pattern => name.includes(pattern));
    }) || null;
}

function buildWelcomeMessage(guild, user, channels = {}) {
    const rulesMention = channels.rulesChannel
        ? `<#${channels.rulesChannel.id}>`
        : '🎄〣𝚁𝚞𝚕𝚎§';

    const chatMention = channels.chatChannel
        ? `<#${channels.chatChannel.id}>`
        : '☃『𝙲𝚑𝚊𝚝』';

    const videoMention = channels.videoChannel
        ? `<#${channels.videoChannel.id}>`
        : '🎄〣𝚅𝚒𝚍𝚎𝚘-𝙽𝚘𝚝𝚒𝚏𝚒𝚌𝚊𝚝𝚒𝚘𝚗…';

    const rolesMention = channels.rolesChannel
        ? `<#${channels.rolesChannel.id}>`
        : '𒀽〢𝚁𝚘𝚕𝚎𝚜-𝚒𝚗𝚏𝚘';

    return [
        `Welcome ${user} to ${guild.name}! 🎉`,
        '',
        '୨୧━━━━━━━━━━━━━━━━━━୨୧',
        '',
        '📜 Read the Rules to avoid Punishment',
        rulesMention,
        '',
        '💬 You can chat here and have fun',
        chatMention,
        '',
        '୨୧━━━━━━━━━━━━━━━━━━୨୧',
        '',
        '🔔 Also check out other channels',
        `🎥 ${videoMention}`,
        `🎭 ${rolesMention}`,
        '',
        '୨୧━━━━━━━━━━━━━━━━━━୨୧',
    ].join('\n');
}

async function handleVerification(member, guild, verificationConfig, client) {
    const { autoVerifyOnJoin } = await import('../services/verificationService.js');
    
    try {
        const result = await autoVerifyOnJoin(client, guild, member, verificationConfig);
        
        if (result.autoVerified) {
            logger.info('User auto-verified on join', {
                guildId: guild.id,
                userId: member.id,
                userTag: member.user.tag,
                roleName: result.roleName,
                criteria: result.criteria
            });
        } else {
            logger.debug('User not auto-verified on join', {
                guildId: guild.id,
                userId: member.id,
                reason: result.reason
            });
        }

    } catch (error) {
        logger.error('Error in auto-verification for member', {
            guildId: guild.id,
            userId: member.id,
            userTag: member.user.tag,
            error: error.message
        });
    }
}

async function assignRoleSafely(member, role) {
    try {
        await member.roles.add(role);
    } catch (error) {
        logger.warn(`Failed to assign role ${role.id} to member ${member.id}:`, error);
    }
}
