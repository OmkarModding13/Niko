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

function createGameEmbed(userData, resultText = null) {
    const embed = new EmbedBuilder()
        .setTitle('💠 Shard Gamble')
        .setColor(getColor('primary'))
        .setDescription(
            '**Risk your Souls for a chance to discover the rarest currency.**\n\n' +
            '**How to Play**\n' +
            SOULS_EMOJI + ' **1 Spin** — 1,000 Souls\n' +
            SOULS_EMOJI + ' **10 Spins** — 10,000 Souls\n\n' +
            '**Possible Outcome**\n' +
            SHARD_EMOJI + ' **1–10 Shards** — Extremely Rare\n' +
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
        .setFooter({ text: 'Choose your spin below • Shards are extremely rare.' });

    if (resultText) {
        embed.addFields({
            name: '🎯 Spin Result',
            value: resultText,
            inline: false
        });
    }

    return embed;
}

function createResultText(results) {
    const won = results.filter(result => result.won);
    const misses = results.length - won.length;

    if (won.length === 0) {
        return '❌ **Better Luck Next Time!**\nNo Shards were found.';
    }

    const totalShards = won.reduce((sum, result) => sum + result.shards, 0);

    const rewardLines = results
        .map((result, index) => {
            if (!result.won) {
                return '❌ Spin ' + (index + 1) + ': Better Luck Next Time';
            }

            return SHARD_EMOJI + ' Spin ' + (index + 1) + ': **+' + result.shards + ' Shards**';
        })
        .join('\n');

    let text =
        '🎉 **You found ' +
        totalShards +
        ' Shard' +
        (totalShards === 1 ? '' : 's') +
        '!**\n\n' +
        rewardLines;

    if (misses > 0 && results.length === 10) {
        text += '\n\n' + SHARD_EMOJI + ' **Total Found: +' + totalShards + ' Shards**';
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
                        content:
                            '❌ You need ' +
                            SOULS_EMOJI +
                            ' **' +
                            cost.toLocaleString() +
                            ' Souls**, but you only have ' +
                            TOTAL_EMOJI +
                            ' **' +
                            Number(userData.wallet || 0).toLocaleString() +
                            ' Souls**.',
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
