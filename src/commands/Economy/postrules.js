import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';

const RULES_CHANNEL_ID = '1530876980873007174';

export default {
    data: new SlashCommandBuilder()
        .setName('postrules')
        .setDescription('Post the server rules in the Rules channel.'),

    async execute(interaction) {
        // Server owner only
        if (
            !interaction.guild ||
            interaction.guild.ownerId !== interaction.user.id
        ) {
            await interaction.reply({
                content: '❌ Only the server owner can use this command.',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        const channel =
            interaction.guild.channels.cache.get(
                RULES_CHANNEL_ID
            );

        if (!channel) {
            await interaction.reply({
                content:
                    '❌ Rules channel was not found.',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(
                '✦━━━━━━━━━━━━━━━━━━━━✦\n' +
                "HOLLOW DEVIL'S DOMAIN\n" +
                'SERVER RULES\n' +
                '✦━━━━━━━━━━━━━━━━━━━━✦'
            )
            .setDescription(
                '⚪ **Respect Everyone**\n' +
                'Treat everyone with respect. Harassment, hate speech, discrimination, or personal attacks are not allowed.\n\n' +

                '⚪ **No NSFW Content**\n' +
                'Pornographic, sexually explicit, or disturbing content is strictly prohibited.\n\n' +

                '⚪ **No Spam**\n' +
                'Avoid spam, excessive mentions, repeated messages, or unnecessary emojis.\n\n' +

                '⚪ **Stay on Topic**\n' +
                'Use the appropriate channels for discussions. Keep conversations organized.\n\n' +

                '⚪ **No Advertising**\n' +
                'Do not promote your own server, YouTube channel, social media, or products without staff permission.\n\n' +

                '⚪ **No Cheats or Illegal Content**\n' +
                'Sharing hacks, malware, piracy, scams, or illegal content is prohibited.\n\n' +

                '⚪ **Keep It Friendly**\n' +
                'Healthy debates are welcome, but toxicity and unnecessary drama are not.\n\n' +

                '⚪ **Use Common Sense**\n' +
                'If something feels inappropriate, don’t do it. Staff decisions are final.\n\n' +

                '⚪ **English & Hinglish Only**\n' +
                'Please communicate in English or Hinglish so everyone can understand.\n\n' +

                '⚪ **Have Fun!**\n' +
                'Enjoy the community, make friends, and respect fellow members.\n\n' +

                '✦━━━━━━━━━━━━━━━━━━━━✦'
            );

        const violationEmbed = new EmbedBuilder()
            .setColor(0xFAA61A)
            .setDescription(
                '⚠️ **RULE VIOLATIONS**\n\n' +

                'Breaking the Rules May Result In:\n\n' +

                '❶ **Warning**\n' +
                '❷ **Mute**\n' +
                '❸ **Kick**\n' +
                '❹ **Temporary Ban**\n' +
                '❺ **Permanent Ban**\n\n' +

                'Depending on the severity of the violation.\n\n' +

                '━━━━━━━━━━━━━━━━━━━━\n\n' +

                '👹 **FINAL MESSAGE**\n\n' +

                'Welcome to **Hollow Devil’s Domain**.\n' +
                'Respect the community, enjoy the chaos,\n' +
                'and most importantly...\n\n' +

                '💙 **Have Fun!**\n\n' +

                '━━━━━━━━━━━━━━━━━━━━'
            );

        try {
            await channel.send({
                embeds: [
                    embed,
                    violationEmbed
                ]
            });

            await interaction.reply({
                content:
                    `✅ Rules successfully posted in <#${RULES_CHANNEL_ID}>.`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error(
                '[POSTRULES] Failed to post rules:',
                error
            );

            await interaction.reply({
                content:
                    '❌ I could not post the rules. Check that I have permission to send messages and embeds in the Rules channel.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
