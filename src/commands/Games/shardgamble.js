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
const SHARD_CHANCE = 0.01;

const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_EMOJI = '<:Total:1547545479628333086>';

const SOULS_BUTTON_EMOJI = {
    id: '1547510037621112894',
    name: 'Souls'
};

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
    if (Math.random() >= SHARD_CHANCE) {
        return { won: false, shards: 0 };
    }

    return {
        won: true,
        shards: pickShardReward()
    };
}

function createButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('shardgamble_1')
            .setLabel('1 Spin • 1,000 Souls')
            .setEmoji(SOULS_BUTTON_EMOJI)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),

        new ButtonBuilder()
            .setCustomId('shardgamble_10')
            .setLabel('10 Spins • 10,000 Souls')
            .setEmoji(SOULS_BUTTON_EMOJI)
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );
}

function createGameEmbed(userData) {
    return new EmbedBuilder()
        .setTitle('💠 Shard Gamble')
        .setColor(getColor('primary'))
        .setDescription(
            '**Risk your Souls for a chance to discover the rarest currency.**\n\n' +
            '**How to Play**\n' +
            SOULS_EMOJI + ' **1 Spin** — 1,000 Souls\n' +
            SOULS_EMOJI + ' **10 Spins** — 10,000 Souls\n\n' +
            '**Possible Outcome**\n' +
            SHARD_EMOJI + ' **1–10 Shards** — Rare\n' +
            '❌ **Better Luck Next Time** — Most spins'
        )
        .addFields(
            {
                name: TOTAL_EMOJI + ' Your Souls',
                value: SOULS_EMOJI + ' **' + Number(userData.wallet || 0).toLocaleString() + ' Souls**',
                inline: true
            },
            {
                name: SHARD_EMOJI + ' Your Shards',
                value: SHARD_EMOJI + ' **' + Number(userData.shards || 0).toLocaleString() + ' Shards**',
                inline: true
            }
        )
        .setFooter({ text: 'Choose your spin below • 1% Shard chance per spin.' });
}

function createRewardEmbed(results, cost) {
    const rewardLines = results.map((result, index) => {
        if (!result.won) {
            return '**' + (index + 1) + '.** ❌ **Better Luck Next Time!**';
        }

        return '**' + (index + 1) + '.** ' +
            SHARD_EMOJI + ' **+' + result.shards + ' Shard' +
            (result.shards === 1 ? '' : 's') + '**';
    });

    const totalShards = results.reduce((sum, result) => sum + result.shards, 0);

    return new EmbedBuilder()
        .setColor(totalShards > 0 ? 0x168BFF : 0x555555)
        .setTitle(SHARD_EMOJI + ' Shard Gamble — Rewards')
        .setDescription(rewardLines.join('\n'))
        .addFields(
            {
                name: SOULS_EMOJI + ' Souls Spent',
                value: '**' + cost.toLocaleString() + ' Souls**',
                inline: true
            },
            {
                name: SHARD_EMOJI + ' Shards Found',
                value: '**+' + totalShards.toLocaleString() + ' Shards**',
                inline: true
            }
        )
        .setFooter({ text: 'Better Luck Next Time • 1% Shard chance per spin.' });
}

export default {
    data: new SlashCommandBuilder()
        .setName('shardgamble')
        .setDescription('Gamble Souls for a chance to find rare Shards.'),

    async execute(interaction, config, client) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const userData = await getEconomyData(client, guildId, userId);

        const assetPath = join(process.cwd(), 'src', 'assets', 'shardgamble.png');
        const banner = new AttachmentBuilder(assetPath, { name: 'shardgamble.png' });

        await interaction.reply({
            files: [banner],
            embeds: [createGameEmbed(userData)],
            components: [createButtons()]
        });

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            time: 300000
        });

        collector.on('collect', async componentInteraction => {
            try {
                if (componentInteraction.user.id !== userId) {
                    await componentInteraction.reply({
                        content: '❌ This Shard Gamble belongs to someone else. Use /shardgamble to play.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await componentInteraction.deferUpdate();

                const spins = componentInteraction.customId === 'shardgamble_10' ? 10 : 1;
                const cost = spins === 10 ? TEN_SPIN_COST : SPIN_COST;

                const latestData = await getEconomyData(client, guildId, userId);

                if (Number(latestData.wallet || 0) < cost) {
                    await componentInteraction.followUp({
                        content:
                            '❌ You need ' +
                            SOULS_EMOJI +
                            ' **' +
                            cost.toLocaleString() +
                            ' Souls**, but you only have ' +
                            TOTAL_EMOJI +
                            ' **' +
                            Number(latestData.wallet || 0).toLocaleString() +
                            ' Souls**.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                latestData.wallet = Number(latestData.wallet || 0) - cost;
                latestData.shards = Number(latestData.shards || 0);

                const results = Array.from({ length: spins }, spinOnce);
                const totalShards = results.reduce((sum, result) => sum + result.shards, 0);

                latestData.shards += totalShards;

                await setEconomyData(client, guildId, userId, latestData);

                await componentInteraction.followUp({
                    embeds: [createRewardEmbed(results, cost)]
                });
            } catch (error) {
                console.error('[SHARD_GAMBLE] Component error:', error);

                if (!componentInteraction.replied && !componentInteraction.deferred) {
                    await componentInteraction.reply({
                        content: '❌ Something went wrong while processing the gamble.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                } else {
                    await componentInteraction.followUp({
                        content: '❌ Something went wrong while processing the gamble.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
            }
        });

        collector.on('end', async () => {
            try {
                await interaction.editReply({ components: [createButtons(true)] });
            } catch {}
        });
    }
};
