import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { isBotOwner } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

const CHANNEL_ID = '1536029867143856302';

const ANNOUNCEMENT = {
  title: '📢 Niko — Economy Update is Live!',
  description: [
    '',
    'Niko has received a **major system update**, bringing the bot out of its testing phase and officially starting the **Niko Economy**. 💙',
    '',
    '🏆 **🆕 ECONOMY SYSTEM — OFFICIALLY LIVE**',
    '',
    'The systems that were previously being tested are now ready for the official launch:',
    '',
    '• <:Souls:1547510037621112894> **Souls & Bank** — Earn, save and spend your Souls',
    '• 🎰 **Gacha & Characters** — Collect characters and Shards',
    '• 🎮 **Games** — Play different games to earn Souls',
    '• 📊 **Leaderboards** — Compete and track your progress',
    '• ⭐ **Leveling System** — Gain XP and level up',
    '• <:Shard:1548962748321374218> **Shards** — Collect and use them across the economy',
    '',
    '🧪 **FROM TESTING TO OFFICIAL**',
    '',
    "Everything that existed before this update was part of **Niko's testing phase**. The economy, rewards and other systems were being tested and balanced during that period.",
    '',
    '**The testing phase is now over.**',
    '',
    'From now on, your **Souls, Shards, Characters, Levels, Leaderboard progress and other economy progress** are part of the official Niko system.',
    '',
    '🔄 **FRESH ECONOMY START**',
    '',
    'Because this is the official launch of the economy:',
    '',
    '• Previous Souls were not carried over',
    '• Previous Shards were not carried over',
    '• Previous Characters were not carried over',
    '• Previous economy progress was not carried over',
    '',
    'Everyone starts **fresh from here.** 🆕',
    '',
    '🔧 **BUG FIXES & IMPROVEMENTS**',
    '',
    'We\'ve also fixed and improved several systems based on previous testing:',
    '',
    '• Fixed multiple economy-related issues',
    '• Improved data saving reliability',
    '• Fixed balance and reward issues',
    '• Improved leaderboard tracking',
    '• Fixed several system issues',
    '• Improved overall bot stability and reliability',
    '',
    'Niko will continue to be improved as the community grows. 💙',
    '',
    '🎮 **Play • <:Souls:1547510037621112894> Earn Souls • 🎰 Collect Characters • 🏆 Reach the Top**',
    '',
    '**— Niko 💙**',
  ].join('\n'),
};

export default {
  data: new SlashCommandBuilder()
    .setName('postnotify')
    .setDescription('Post the Niko economy announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isBotOwner(interaction.user.id)) {
      await InteractionHelper.safeReply(interaction, {
        content: '❌ This command is restricted to the bot owner.',
        ephemeral: true,
      });
      return;
    }

    const channel = await interaction.client.channels.fetch(CHANNEL_ID);

    if (!channel?.isTextBased()) {
      throw new Error(`Postnotify channel ${CHANNEL_ID} is unavailable or not text-based.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(ANNOUNCEMENT.title)
      .setDescription(ANNOUNCEMENT.description)
      .setColor(0x0054ff)
      .setFooter({ text: 'Niko' });

    await channel.send({
      content: '@everyone',
      embeds: [embed],
      allowedMentions: { parse: ['everyone'] },
    });

    await InteractionHelper.safeReply(interaction, {
      content: `✅ Announcement posted in <#${CHANNEL_ID}>.`,
      ephemeral: true,
    });

    logger.info('Niko economy announcement posted', {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: CHANNEL_ID,
    });
  },
};
