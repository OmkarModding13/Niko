import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    AttachmentBuilder,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import { join } from 'node:path';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getColor } from '../../config/bot.js';

const SPIN_COST = 1000;
const TEN_SPIN_COST = 10000;
const SHARD_CHANCE = 0.002;

const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_EMOJI = '<:Total:1547545479628333086>';

const SHARD_REWARDS = [
    { shards: 1, weight: 55 },
    { shards: 2, weight: 25 },
    { shards: 3, weight: 10 },
    { shards: 5, weight: 6 },
    { shards: 10, weight: 4 }
];

function pickShardReward() {
    let roll = Math.random() * 100;
    for (const reward of SHARD_REWARDS) {
        roll -= reward.weight;
        if (roll < 0) return reward.shards;
    }
    return 1;
}

function spinOnce() {
    if (Math.random() >= SHARD_CHANCE) return { won: false, shards: 0 };
    return { won: true, shards: pickShardReward() };
}

function createButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('shardgamble_1')
            .setLabel('1 Spin • 1,000 Souls')
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('shardgamble_10')
            .setLabel('10 Spins • 10,000 Souls')
            .setEmoji('🎰')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );
}

function createGameEmbed(userData, resultText = null) {
    const embed = new EmbedBuilder()
        .setTitle('💠 Shard Gamble')
        .setColor(getColor('primary'))
        .setDescription(
            'Spend your Souls and gamble for the extremely rare Shards.\n\n' +
            '💰 1 Spin: ' + SOULS_EMOJI + ' 1,000 Souls\n' +
            '🎰 10 Spins: ' + SOULS_EMOJI + ' 10,000 Souls\n\n' +
            '✨ Shard Chance: Extremely Rare\n' +
            '💠 Reward: 1–10 Shards\n' +
            '❌ Most spins: Better Luck Next Time!'
        )
        .addFields(
            {
                name: TOTAL_EMOJI + ' Your Souls',
                value: SOULS_EMOJI + ' ' + Number(userData.wallet || 0).toLocaleString() + ' Souls',
                inline: true
            },
            {
                name: SHARD_EMOJI + ' Your Shards',
                value: Number(userData.shards || 0).toLocaleString() + ' Shards',
                inline: true
            }
        )
        .setFooter({ text: 'Shards are rare. Gamble responsibly.' });

    if (resultText) {
        embed.addFields({ name: '🎲 Result', value: resultText, inline: false });
    }

    return embed;
}

function createResultText(results) {
    const won = results.filter(result => result.won);
    const misses = results.length - won.length;

    if (won.length === 0) {
        return '❌ Better Luck Next Time!\n\nNo Shards were found.';
    }

    const totalShards = won.reduce((sum, result) => sum + result.shards, 0);
    const rewardLines = won.map((result, index) =>
        '💠 Spin ' + (results.indexOf(result) + 1) + ': +' + result.shards + ' Shards'
    );

    let text = '🎉 You found ' + totalShards + ' Shard' + (totalShards === 1 ? '' : 's') + '!\n\n';
    text += rewardLines.join('\n');

    if (misses > 0) {
        text += '\n\n❌ ' + misses + ' spin' + (misses === 1 ? '' : 's') + ' gave Better Luck Next Time!';
    }

    return text;
}

export default {
    data: new SlashCommandBuilder()
        .setName('shardgamble')
        .setDescription('Gamble Souls for a chance to find rare Shards.'),

    async execute(interaction, config, client) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        let userData = await getEconomyData(client, guildId, userId);

        const assetPath = join(process.cwd(), 'src', 'assets', 'shardgamble.png');
        const banner = new AttachmentBuilder(assetPath, { name: 'shardgamble.png' });

        await interaction.reply({
            files: [banner],
            embeds: [createGameEmbed(userData)],
            components: [createButtons()]
        });

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async componentInteraction => {
            try {
                if (componentInteraction.user.id !== userId) {
                    await componentInteraction.reply({
                        content: '❌ This Shard Gamble belongs to someone else. Use /shardgamble to play.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const spins = componentInteraction.customId === 'shardgamble_10' ? 10 : 1;
                const cost = spins === 10 ? TEN_SPIN_COST : SPIN_COST;

                userData = await getEconomyData(client, guildId, userId);

                if (Number(userData.wallet || 0) < cost) {
                    await componentInteraction.reply({
                        content: '❌ You need ' + SOULS_EMOJI + ' ' + cost.toLocaleString() +
                            ' Souls, but you only have ' + TOTAL_EMOJI + ' ' +
                            Number(userData.wallet || 0).toLocaleString() + ' Souls.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                userData.wallet = Number(userData.wallet || 0) - cost;
                userData.shards = Number(userData.shards || 0);

                const results = Array.from({ length: spins }, spinOnce);
                const totalShards = results.reduce((sum, result) => sum + result.shards, 0);

                userData.shards += totalShards;

                await setEconomyData(client, guildId, userId, userData);

                await componentInteraction.update({
                    embeds: [createGameEmbed(userData, createResultText(results))],
                    components: [createButtons()]
                });
            } catch (error) {
                console.error('[SHARD_GAMBLE] Component error:', error);

                if (!componentInteraction.replied && !componentInteraction.deferred) {
                    await componentInteraction.reply({
                        content: '❌ Something went wrong while processing the gamble.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
            }
        });

        collector.on('end', async () => {
            try {
                const latestData = await getEconomyData(client, guildId, userId);
                await message.edit({
                    embeds: [createGameEmbed(latestData)],
                    components: [createButtons(true)]
                });
            } catch {}
        });
    }
};
