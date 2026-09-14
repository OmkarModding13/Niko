import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EARN_CHANNEL_ID = '1548932541283835904';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
const EMBED_BLUE = 0x168BFF;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BANNER_PATH = path.join(__dirname, '../../assets/HowToEarn.png');

function buildEarnInfoEmbed() {
    return new EmbedBuilder()
        .setColor(EMBED_BLUE)
        .setTitle(`${TOTAL_SOULS_EMOJI} HOW TO EARN SOULS`)
        .setDescription(
            '**Want to earn Souls in Hollow Devil\'s Domain?**\n' +
            'Here are the main ways to earn and use your Souls.\n\n' +
            '**🎁 Daily Reward**\n' +
            'Use **/daily** once every 24 hours to claim your daily Souls reward.\n' +
            '> 🔥 Keep your streak going to unlock extra streak bonuses.\n\n' +
            '**💬 Chatting**\n' +
            'Stay active and chat with the community to earn Souls over time.\n' +
            '> ⚠️ Spam and message flooding will not help you earn more.\n\n' +
            '**🎙️ Voice Chat**\n' +
            'Hang out with other members in Voice Channels and earn Souls through active VC time.\n' +
            '> 👥 At least **2 members** must be in the VC.\n' +
            '> 🔇 Self-muted activity does not count.\n' +
            '> 🙉 Self-deafened activity does not count.\n\n' +
            '**🎮 Gaming**\n' +
            'Play Niko\'s games to win Souls and take part in PvP and multiplayer matches.\n' +
            `> ${DOUBLE_SOULS_EMOJI} Some games can give higher rewards depending on the game and outcome.\n\n` +
            '**🛒 Shop**\n' +
            'Use **/shop** to spend your Souls on available rewards and upgrades.\n' +
            '> 🎨 Color Roles\n' +
            '> 🏦 Bank Capacity Upgrades\n' +
            '> ℹ️ The Shop is for spending Souls, not a direct earning method.\n\n' +
            `🩸 **Stay Active. Earn Souls. Build Your Wealth.** ${TOTAL_SOULS_EMOJI}`,
        )
        .setFooter({ text: 'Hollow Devil’s Domain • Souls Guide' });
}

export default {
    data: new SlashCommandBuilder()
        .setName('postearninfo')
        .setDescription('Post the How to Earn Souls guide')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    category: 'Economy',

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need the **Manage Server** permission to use this command.',
                ephemeral: true,
            });
        }

        const channel = await interaction.guild.channels.fetch(EARN_CHANNEL_ID).catch(() => null);

        if (!channel?.isTextBased()) {
            return interaction.reply({
                content: '❌ The configured How to Earn channel could not be found.',
                ephemeral: true,
            });
        }

        const banner = new AttachmentBuilder(BANNER_PATH, { name: 'HowToEarn.png' });
        const embed = buildEarnInfoEmbed();

        // Send the banner separately so it appears above the guide embed.
        await channel.send({ files: [banner] });
        await channel.send({ embeds: [embed] });

        return interaction.reply({
            content: `✅ How to Earn guide posted in <#${EARN_CHANNEL_ID}>.`,
            ephemeral: true,
        });
    },
};
