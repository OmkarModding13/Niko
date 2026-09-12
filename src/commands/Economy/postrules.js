import {
    SlashCommandBuilder,
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
                content: '❌ Rules channel was not found.',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        const rulesMessage = `
✦━━━━━━━━━━━━━━━━━━━━✦
**HOLLOW DEVIL'S DOMAIN**
**SERVER RULES**
✦━━━━━━━━━━━━━━━━━━━━✦

⚪ **Respect Everyone**

Treat everyone with respect. Harassment, hate speech, discrimination, or personal attacks are not allowed.

⚪ **No NSFW Content**

Pornographic, sexually explicit, or disturbing content is strictly prohibited.

⚪ **No Spam**

Avoid spam, excessive mentions, repeated messages, or unnecessary emojis.

⚪ **Stay on Topic**

Use the appropriate channels for discussions. Keep conversations organized.

⚪ **No Advertising**

Do not promote your own server, YouTube channel, social media, or products without staff permission.

⚪ **No Cheats or Illegal Content**

Sharing hacks, malware, piracy, scams, or illegal content is prohibited.

⚪ **Keep It Friendly**

Healthy debates are welcome, but toxicity and unnecessary drama are not.

⚪ **Use Common Sense**

If something feels inappropriate, don't do it. Staff decisions are final.

⚪ **English & Hinglish Only**

Please communicate in English or Hinglish so everyone can understand.

⚪ **Have Fun!**

Enjoy the community, make friends, and respect fellow members.

✦━━━━━━━━━━━━━━━━━━━━✦

⚠️ **RULE VIOLATIONS**

Breaking the Rules May Result In:

❶ **Warning**  
❷ **Mute**  
❸ **Kick**  
❹ **Temporary Ban**  
❺ **Permanent Ban**

Depending on the severity of the violation.

━━━━━━━━━━━━━━━━━━━━

👹 **FINAL MESSAGE**

Welcome to **Hollow Devil's Domain**.

Respect the community, enjoy the chaos,
and most importantly...

💙 **Have Fun!**

━━━━━━━━━━━━━━━━━━━━
`;

        try {
            await channel.send({
                content: rulesMessage
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
                    '❌ I could not post the rules. Check that I have permission to send messages in the Rules channel.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
