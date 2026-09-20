import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getUserLevelData, getLevelingConfig, getXpForLevel } from '../../services/leveling/leveling.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { isBotOwner } from '../../config/bot.js';

const LEVEL_CHECK_CHANNEL_ID = '1551159198425948180';
export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription("Check your or another user's rank and level")
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to check the rank of')
        .setRequired(false)
    )
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    const isOwner =
      isBotOwner(interaction.user.id) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!isOwner && interaction.channelId !== LEVEL_CHECK_CHANNEL_ID) {
      return interaction.reply({
        content: `❌ Please use **/rank** in <#${LEVEL_CHECK_CHANNEL_ID}>.`,
        ephemeral: true
      });
    }

    await InteractionHelper.safeDefer(interaction);

    const levelingConfig = await getLevelingConfig(client, interaction.guildId);
    if (!levelingConfig?.enabled) {
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription('The leveling system is currently disabled on this server.')
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!member) {
      throw new TitanBotError(
        `User ${targetUser.id} not found in guild`,
        ErrorTypes.USER_INPUT,
        'Could not find the specified user in this server.'
      );
    }

    const userData = await getUserLevelData(client, interaction.guildId, targetUser.id);

    const safeUserData = {
      level: userData?.level ?? 0,
      xp: userData?.xp ?? 0,
      totalXp: userData?.totalXp ?? 0
    };

    const xpNeeded = getXpForLevel(safeUserData.level + 1);
    const xpRemaining = Math.max(0, xpNeeded - safeUserData.xp);
    const progress = xpNeeded > 0 ? Math.floor((safeUserData.xp / xpNeeded) * 100) : 0;
    const progressBar = createProgressBar(progress, 20);

    const embed = new EmbedBuilder()
      .setTitle(`${member.displayName}'s Rank`)
      .setThumbnail(member.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: 'Level',
          value: safeUserData.level.toString(),
          inline: true
        },
        {
          name: 'XP',
          value: `${safeUserData.xp}/${xpNeeded} XP\n**${xpRemaining} XP needed** to level up`,
          inline: true
        },
        {
          name: 'Total XP',
          value: safeUserData.totalXp.toString(),
          inline: true
        },
        {
          name: `Progress to Level ${safeUserData.level + 1}`,
          value: `${progressBar} ${progress}%`
        }
      )
      .setColor('#2ecc71')
      .setTimestamp();

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.debug(`Rank checked for user ${targetUser.id} in guild ${interaction.guildId}`);
  }
};

function createProgressBar(percentage, length = 10) {
  if (percentage < 0 || percentage > 100) {
    percentage = Math.max(0, Math.min(100, percentage));
  }
  const filled = Math.round((percentage / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}