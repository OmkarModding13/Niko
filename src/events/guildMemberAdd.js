// Dynamic welcome banner enabled
// Railway auto deploy test
import { Events, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { getColor } from '../config/bot.js';
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
        
        const config = await getGuildConfig(member.client, guild.id);
        
        const welcomeConfig = await getWelcomeConfig(member.client, guild.id);
        
        const welcomeChannelId = welcomeConfig?.channelId;

        if (welcomeConfig?.enabled && welcomeChannelId) {
            const channel = guild.channels.cache.get(welcomeChannelId);
            const me = guild.members.me;
            const permissions = channel?.isTextBased?.() && me ? channel.permissionsFor(me) : null;
            // Skip only the welcome message if permissions are missing; the rest of the
            // join pipeline (auto-role, verification, logging, counters) must still run.
            if (permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                const rulesChannel = findWelcomeChannel(
                    guild,
                    ['rule', '𝚛𝚞𝚕𝚎', '𝚛𝚞𝚕𝚎𝚜']
                );
                const chatChannel = findWelcomeChannel(
                    guild,
                    ['chat', '𝚌𝚑𝚊𝚝']
                );
                const videoChannel = findWelcomeChannel(
                    guild,
                    ['video-notification', 'video notification']
                );
                const rolesChannel = findWelcomeChannel(
                    guild,
                    ['roles-info', 'roles info']
                );

                const welcomeMessage = buildWelcomeMessage(guild, user, {
                    rulesChannel,
                    chatChannel,
                    videoChannel,
                    rolesChannel,
                });

                const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);

                if (!canEmbed) {
                    await channel.send({
                        content: welcomeMessage
                    });
                } else {
                    let welcomeAttachment = null;

const backgroundUrl =
    welcomeConfig.welcomeImage ||
    welcomeConfig.welcomeEmbed?.image?.url;

if (backgroundUrl) {
    try {
        const imageBuffer = await generateWelcomeImage({
            backgroundUrl,
            avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
            username: user.username,
            memberCount: guild.memberCount
        });

        welcomeAttachment = new AttachmentBuilder(imageBuffer, {
            name: 'welcome.png'
        });
    } catch (error) {
        logger.error('Failed to generate dynamic welcome image:', error);
    }
}

await channel.send({
    content: welcomeMessage,
    files: welcomeAttachment ? [welcomeAttachment] : []
});
                }
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
