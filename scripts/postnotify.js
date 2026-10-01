import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

const CHANNEL_ID = '1536029867143856302';

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel?.isTextBased()) {
            throw new Error('Target channel is not a text-based channel.');
        }

        const description = [
            'Hey @everyone! 👋',
            '',
            'Niko has received a **major system update**, bringing the bot out of its testing phase and officially starting the **Niko Economy**. 💙',
            '',
            '🏆 **🆕 ECONOMY SYSTEM — OFFICIALLY LIVE**',
            '',
            'The systems that were previously being tested are now ready for the official launch:',
            '',
            '• 🪙 **Souls & Bank** — Earn, save and spend your Souls',
            '• 🎰 **Gacha & Characters** — Collect characters and Shards',
            '• 🎮 **Games** — Play different games to earn Souls',
            '• 📊 **Leaderboards** — Compete and track your progress',
            '• ⭐ **Leveling System** — Gain XP and level up',
            '• 💎 **Shards** — Collect and use them across the economy',
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
            "We've also fixed and improved several systems based on previous testing:",
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
            '🎮 **Play • 🪙 Earn Souls • 🎰 Collect Characters • 🏆 Reach the Top**',
            '',
            '**— Niko 💙**',
        ].join('\\n');

        const embed = new EmbedBuilder()
            .setColor(0x2196F3)
            .setTitle('📢 Niko — Economy Update is Live!')
            .setDescription(description);

        await channel.send({
            content: '@everyone',
            embeds: [embed],
            allowedMentions: { parse: ['everyone'] },
        });

        console.log('✅ Niko test notification posted successfully.');
    } catch (error) {
        console.error('❌ Failed to post Niko test notification:', error);
        process.exitCode = 1;
    } finally {
        client.destroy();
    }
});

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing.');
    process.exitCode = 1;
} else {
    client.login(process.env.DISCORD_TOKEN).catch((error) => {
        console.error('❌ Discord login failed:', error);
        process.exitCode = 1;
    });
}
