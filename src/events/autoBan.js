import { PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';
import { incrementAutoBanCounter } from '../utils/database.js';
import { EmbedBuilder } from 'discord.js';
import {
    getAutoBanEmbed,
    saveAutoBanEmbed
} from '../utils/database.js';


const AUTO_BAN_CHANNEL_ID = '1530876980873007178';

async function updateAutoBanEmbed(message, banCount) {
    try {
        const channel = message.channel;

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚨 Anti Bot Channel 🚨')
.setDescription(
    '# **DO NOT TYPE IN HERE**\n\n' +
    '**If you type in here, you will be automatically blocked from the server**\n\n' +
    'This channel is monitored automatically for spam bots, compromised accounts,\n' +
    'and automated raid tools.'
)
            .addFields({
                name: 'Members Blocked',
                value: `**${banCount}**`,
                inline: false
            })
            .setFooter({
                text: `Hollow Devils Domain Anti-Bot System • Updates automatically • ${new Date().toLocaleString('en-GB')}`
            });

        

        // First time: new embed create karo
        const savedEmbed = await getAutoBanEmbed(
    message.client,
    message.guild.id
);

// Existing embed ko update karo
if (savedEmbed?.messageId) {
    try {
        const existingMessage = await channel.messages.fetch(
            savedEmbed.messageId
        );

        await existingMessage.edit({
            embeds: [embed]
        });

        return;
    } catch {
        // Old embed nahi mila, naya create karenge
    }
}

// Embed nahi mila toh naya create karo
const newMessage = await channel.send({
    embeds: [embed]
});

await saveAutoBanEmbed(
    message.client,
    message.guild.id,
    {
        messageId: newMessage.id,
        channelId: channel.id
    }
);
    } catch (error) {
        logger.error('[Auto-Ban] Failed to update anti-bot embed:', error);
    }
}

export default {
    name: 'messageCreate',

    async execute(message) {
        // Ignore bots
        if (message.author.bot) return;

        // Only work in the Auto-Ban channel
        if (message.channel.id !== AUTO_BAN_CHANNEL_ID) return;
        
        // Protect server owner
if (message.guild?.ownerId === message.author.id) return;

        try {
            // Delete the message first
            await message.delete();

            // Ban the member
            if (message.member?.bannable) {
    await message.member.ban({
        reason: 'Sent a message in the Anti-Bot / Auto-Ban channel.'
    });

                


const banCount = await incrementAutoBanCounter(
    message.client,
    message.guild.id
);

logger.info(
    `[Auto-Ban] Permanent ban count: ${banCount}`
);

await updateAutoBanEmbed(message, banCount);
                

    logger.info(
        `[Auto-Ban] Banned ${message.author.tag} for messaging in Auto-Ban channel.`
    );
}
            else {
                logger.warn(
                    `[Auto-Ban] Could not ban ${message.author.tag}. Missing permission or member is not bannable.`
                );
            }
        } catch (error) {
            logger.error('[Auto-Ban] Failed to delete message or ban member:', error);
        }
    }
};
