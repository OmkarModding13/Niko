// messageCreate.js

import { Events } from 'discord.js';

import { logger } from '../utils/logger.js';

import {
  getLevelingConfig
} from '../services/leveling/leveling.js';

import {
  addChatMinutes
} from '../services/leveling/xpSystem.js';

import {
  checkRateLimit
} from '../utils/rateLimiter.js';

import {
  parsePrefixCommand
} from '../utils/prefixParser.js';

import {
  supportsPrefixExecution,
  executePrefixCommand,
  resolvePrefixAccessKey
} from '../utils/messageAdapter.js';

import {
  resolveCommandAlias,
  resolveSubcommandAlias
} from '../config/commands/commandAliases.js';

import {
  getPrefixRestriction
} from '../config/commands/prefixRestrictions.js';

import {
  getGuildConfig
} from '../services/config/guildConfig.js';

import {
  getCommandPrefix,
  getBotMessage,
  isBotOwner,
  isCommandCategoryEnabled,
  isMaintenanceMode
} from '../config/bot.js';

import {
  enforceAbuseProtection,
  formatCooldownDuration
} from '../utils/abuseProtection.js';

import {
  createEmbed
} from '../utils/embeds.js';

import {
  isCommandEnabled
} from '../services/commandAccessService.js';

import {
  getCountingGameConfig,
  saveCountingGameConfig,
  isValidCountingMessage,
  recordCorrectCount
} from '../services/countingGameService.js';


/*
 * ==================================================
 * CHAT ACTIVITY SETTINGS
 * ==================================================
 *
 * One eligible message can create one activity
 * interval per minute.
 *
 * This prevents spam from giving unlimited XP.
 *
 * IMPORTANT:
 *
 * This is only the first version of active-chat
 * tracking.
 *
 * Later we can replace this with a proper session
 * based tracker.
 */

const CHAT_ACTIVITY_RATE_LIMIT_ATTEMPTS = 1;

const CHAT_ACTIVITY_RATE_LIMIT_WINDOW_MS =
  60 * 1000;


/*
 * ==================================================
 * EVENT
 * ==================================================
 */

export default {
  name: Events.MessageCreate,

  async execute(message, client) {
    try {

      /*
       * Ignore bots and DMs.
       */
      if (
        message.author.bot ||
        !message.guild
      ) {
        return;
      }


      logger.debug(
        `Message received from ${message.author.tag}: ${message.content}`
      );


      /*
       * ==================================================
       * COUNTING GAME
       * ==================================================
       */

      const countingProcessed =
        await handleCountingGame(
          message,
          client
        );

      if (countingProcessed) {
        return;
      }


      /*
       * ==================================================
       * PREFIX COMMANDS
       * ==================================================
       */

      await handlePrefixCommand(
        message,
        client
      );


      /*
       * ==================================================
       * CHAT ACTIVITY LEVELING
       * ==================================================
       */

      await handleLeveling(
        message,
        client
      );

    } catch (error) {

      logger.error(
        'Error in messageCreate event:',
        error
      );
    }
  }
};


/*
 * ==================================================
 * PREFIX COMMANDS
 * ==================================================
 */

async function handlePrefixCommand(
  message,
  client
) {
  try {

    const guildConfig =
      await getGuildConfig(
        client,
        message.guild.id
      );


    const prefix =
      guildConfig?.prefix ||
      getCommandPrefix();


    const parsed =
      parsePrefixCommand(
        message.content,
        prefix
      );


    if (!parsed) {
      return;
    }


    let {
      commandName,
      args
    } = parsed;


    /*
     * ==================================================
     * MUSIC PREFIX SHORTCUTS
     * ==================================================
     */

    const musicPrefixShortcut =
      commandName.toLowerCase();


    const MUSIC_PREFIX_SHORTCUTS =
      new Set([
        'leave',
        'pause',
        'resume',
        'skip',
        'stop',
        'volume'
      ]);


    if (
      MUSIC_PREFIX_SHORTCUTS.has(
        musicPrefixShortcut
      )
    ) {

      commandName = 'music';

      args = [
        musicPrefixShortcut,
        ...args
      ];
    }


    logger.info(
      `Prefix command detected: ${commandName}, args: ${args.join(', ')}`
    );


    /*
     * ==================================================
     * COMMAND ALIAS
     * ==================================================
     */

    const resolvedCommandName =
      resolveCommandAlias(
        commandName
      );


    logger.info(
      `Resolved command name: ${resolvedCommandName}`
    );


    const command =
      client.commands.get(
        resolvedCommandName
      );


    if (!command) {

      logger.warn(
        `Command not found: ${resolvedCommandName}`
      );

      return;
    }


    /*
     * ==================================================
     * DEDICATED PUBLIC COMMAND CHANNELS
     * ==================================================
     */
    const requiredChannelId =
      PREFIX_COMMAND_CHANNELS.get(resolvedCommandName);

    const isGuildOwner =
      message.guild.ownerId === message.author.id;

    if (
      requiredChannelId &&
      !isBotOwner(message.author.id) &&
      !isGuildOwner &&
      message.channel.id !== requiredChannelId
    ) {
      await message.channel.send({
        content: `❌ Please use **/${resolvedCommandName}** in <#${requiredChannelId}>.`
      }).catch(() => {});
      return;
    }


    /*
     * ==================================================
     * MAINTENANCE MODE
     * ==================================================
     */

    if (
      isMaintenanceMode() &&
      !isBotOwner(
        message.author.id
      )
    ) {

      await message.channel.send({
        embeds: [
          createEmbed({
            title:
              'Maintenance Mode',

            description:
              getBotMessage(
                'maintenanceMode'
              ),

            color:
              'warning'
          })
        ]
      }).catch(() => {});


      return;
    }


    /*
     * ==================================================
     * CATEGORY ENABLED
     * ==================================================
     */

    if (
      !isCommandCategoryEnabled(
        command.category
      )
    ) {

      await message.channel.send({
        embeds: [
          createEmbed({
            title:
              'Feature Disabled',

            description:
              getBotMessage(
                'commandDisabled'
              ),

            color:
              'error'
          })
        ]
      }).catch(() => {});


      return;
    }


    /*
     * ==================================================
     * PREFIX RESTRICTION
     * ==================================================
     */

    const restriction =
      getPrefixRestriction(
        command,
        args,
        resolveSubcommandAlias
      );


    if (
      !supportsPrefixExecution(
        command
      ) ||
      restriction.blocked
    ) {

      if (
        restriction.blocked &&
        restriction.reason
      ) {

        const embed =
          createEmbed({
            title:
              'Slash Command Only',

            description:
              `${restriction.reason}\nUse \`/${resolvedCommandName}\` instead.`,

            color:
              'info'
          });


        await message.channel.send({
          embeds: [
            embed
          ]
        }).catch(() => {});
      }


      return;
    }


    /*
     * ==================================================
     * COMMAND ACCESS
     * ==================================================
     */

    if (
      !(
        await isCommandEnabled(
          client,
          message.guild.id,
          resolvePrefixAccessKey(
            command.data,
            args
          ),
          command.category
        )
      )
    ) {

      const embed =
        createEmbed({
          title:
            'Command Disabled',

          description:
            'This command has been disabled for this server.',

          color:
            'error'
        });


      await message.channel.send({
        embeds: [
          embed
        ]
      }).catch(() => {});


      return;
    }


    /*
     * ==================================================
     * DEFAULT COMMAND PERMISSIONS
     * ==================================================
     *
     * Slash commands are gated by Discord automatically.
     * Prefix commands are not, so mirror the same permission
     * requirement here.
     */
    const requiredPermissions =
      getCommandDefaultPermissions(command.data);

    if (
      requiredPermissions != null &&
      !memberMeetsCommandPermissions(
        message.member,
        requiredPermissions,
        {
          guildConfig,
          commandCategory: command.category
        }
      )
    ) {
      await message.channel.send({
        content: '❌ You do not have permission to use this command.'
      }).catch(() => {});
      return;
    }


    /*
     * ==================================================
     * ABUSE PROTECTION
     * ==================================================
     */

    const mockInteractionForProtection = {
      guildId:
        message.guild.id,

      user:
        message.author
    };


    const abuseProtection =
      await enforceAbuseProtection(
        mockInteractionForProtection,
        command,
        resolvedCommandName
      );


    if (
      !abuseProtection.allowed
    ) {

      const formattedCooldown =
        formatCooldownDuration(
          abuseProtection.remainingMs
        );


      const embed =
        createEmbed({
          title:
            'Command Cooldown',

          description:
            `This command is on cooldown. Please wait ${formattedCooldown} before trying again.`,

          color:
            'error'
        });


      await message.channel.send({
        embeds: [
          embed
        ]
      }).catch(() => {});


      return;
    }


    /*
     * ==================================================
     * EXECUTE PREFIX COMMAND
     * ==================================================
     */

    logger.info(
      `Executing prefix command: ${prefix}${commandName} (resolved to ${resolvedCommandName}) by ${message.author.tag}`
    );


    await executePrefixCommand(
      command,
      message,
      args,
      client,
      prefix,
      guildConfig
    );

  } catch (error) {

    logger.error(
      'Error handling prefix command:',
      error
    );
  }
}


/*
 * ==================================================
 * COUNTING GAME
 * ==================================================
 */

async function handleCountingGame(
  message,
  client
) {
  try {

    const config =
      await getCountingGameConfig(
        client,
        message.guild.id
      );


    /*
     * Not counting channel.
     */
    if (
      !config.enabled ||
      !config.channelId ||
      message.channel.id !==
        config.channelId
    ) {
      return false;
    }


    const content =
      message.content.trim();


    const validCount =
      isValidCountingMessage(
        content,
        config
      );


    const invalidAttempt =
      !validCount ||
      message.author.id ===
        config.lastUserId;


    /*
     * ==================================================
     * COUNT BROKEN
     * ==================================================
     */

    if (invalidAttempt) {

      await message.delete()
        .catch(() => {});


      await saveCountingGameConfig(
        client,
        message.guild.id,
        {
          ...config,

          nextNumber:
            1,

          lastUserId:
            null,

          currentStreak:
            0
        }
      );


      const failureMessage =
        await message.channel.send(
          `❌ Count broken by <@${message.author.id}>. The sequence has been reset to **1**.`
        );


      setTimeout(() => {

        failureMessage
          .delete()
          .catch(() => {});

      }, 10000);


      return true;
    }


    /*
     * ==================================================
     * CORRECT COUNT
     * ==================================================
     */

    await recordCorrectCount(
      client,
      message.guild.id,
      message.author.id
    );


    return true;

  } catch (error) {

    logger.error(
      'Error handling counting game:',
      error
    );


    return false;
  }
}


/*
 * ==================================================
 * LEVELING / CHAT ACTIVITY
 * ==================================================
 */

async function handleLeveling(
  message,
  client
) {
  try {

    /*
     * ==================================================
     * GET CONFIG
     * ==================================================
     */

    const levelingConfig =
      await getLevelingConfig(
        client,
        message.guild.id
      );


    if (
      !levelingConfig?.enabled
    ) {
      return;
    }


    /*
     * ==================================================
     * IGNORED CHANNEL
     * ==================================================
     */

    if (
      levelingConfig
        .ignoredChannels
        ?.includes(
          message.channel.id
        )
    ) {
      return;
    }


    /*
     * ==================================================
     * IGNORED ROLES
     * ==================================================
     */

    if (
      levelingConfig
        .ignoredRoles
        ?.length > 0
    ) {

      const member =
        await message.guild.members
          .fetch(
            message.author.id
          )
          .catch(
            () => null
          );


      if (
        member &&
        member.roles.cache.some(
          role =>
            levelingConfig
              .ignoredRoles
              .includes(
                role.id
              )
        )
      ) {
        return;
      }
    }


    /*
     * ==================================================
     * BLACKLISTED USER
     * ==================================================
     */

    if (
      levelingConfig
        .blacklistedUsers
        ?.includes(
          message.author.id
        )
    ) {
      return;
    }


    /*
     * ==================================================
     * EMPTY MESSAGE
     * ==================================================
     */

    if (
      !message.content ||
      message.content.trim().length === 0
    ) {
      return;
    }


    /*
     * ==================================================
     * CHAT ACTIVITY RATE LIMIT
     * ==================================================
     *
     * One activity interval per minute.
     *
     * So:
     *
     * 1 message
     *   ↓
     * 1 minute activity
     *
     * 100 messages in 10 seconds
     *   ↓
     * still only 1 activity interval
     */

    const rateLimitKey =
      `leveling-chat:${message.guild.id}:${message.author.id}`;


    const canProcess =
      await checkRateLimit(
        rateLimitKey,
        CHAT_ACTIVITY_RATE_LIMIT_ATTEMPTS,
        CHAT_ACTIVITY_RATE_LIMIT_WINDOW_MS
      );


    if (!canProcess) {
      return;
    }


    /*
     * ==================================================
     * RECORD CHAT ACTIVITY
     * ==================================================
     */

    const result =
      await addChatMinutes(
        client,
        message.guild.id,
        message.author.id,
        1
      );


    /*
     * ==================================================
     * LOG
     * ==================================================
     */

    if (
      result?.userData
    ) {

      logger.debug(
        `💬 Recorded 1 minute of chat activity for ${message.author.tag}`
      );


      /*
       * Level-up detection.
       *
       * addChatMinutes() already handles
       * activity + XP.
       */

      if (
        result.leveledUp
      ) {

        logger.info(
          `🎉 ${message.author.tag} reached Level ${result.level}`
        );
      }
    }

  } catch (error) {

    logger.error(
      'Error handling leveling for message:',
      error
    );
  }
}
