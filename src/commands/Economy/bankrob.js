import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { successEmbed, warningEmbed, buildUserErrorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { BotConfig } from '../../config/bot.js';

const SOULS = '<:Souls:1547510037621112894>';
const SHARD = '<:Shard:1548962748321374218>';

const ROB_COOLDOWN = BotConfig.economy?.cooldowns?.rob ?? 4 * 60 * 60 * 1000;
const BASE_ROB_SUCCESS_CHANCE = BotConfig.economy?.robSuccessRate ?? 0.4;
const ROB_REWARD_PERCENTAGE = 0.80;
const POLICE_FINE = 1000;
const POLICE_COOLDOWN = 10 * 60 * 1000;
const RARE_SHARD_CHANCE = 0.05;
const LOBBY_TIMEOUT = 60 * 1000;

const activeLobbies = new Set();

function token() {
    return Math.random().toString(36).slice(2, 10);
}

function fmt(amount) {
    return Number(amount || 0).toLocaleString();
}

function cooldownRemaining(userData, now = Date.now()) {
    const lastRob = Number(userData?.lastRob || 0);
    return Math.max(0, (lastRob + ROB_COOLDOWN) - now);
}

function formatCooldown(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function lobbyText(initiator, target, targetCount, players) {
    const lines = players.map((player, index) =>
        `${index + 1}. <@${player.id}>${index === 0 ? ' — Leader' : ' — Joined'}`
    );

    return [
        '🏦 **BANK ROBBERY LOBBY**',
        '',
        `🎯 **Target:** <@${target.id}>`,
        `👥 **Robbers:** ${players.length}/${targetCount}`,
        '',
        ...lines,
        '',
        players.length < targetCount
            ? 'Click **Join Robbery** to join the crew.'
            : '✅ Crew is ready. Starting the robbery...',
    ].join('\n');
}

async function runRobbery(interaction, client, targetUser, players) {
    const guildId = interaction.guildId;
    const now = Date.now();

    const targetData = await getEconomyData(client, guildId, targetUser.id);
    const playerData = new Map();

    for (const player of players) {
        playerData.set(player.id, await getEconomyData(client, guildId, player.id));
    }

    if (!targetData) {
        throw createError(
            'Failed to load target economy',
            ErrorTypes.DATABASE,
            'Failed to load the target economy data. Please try again.'
        );
    }

    // Bank Protection protects the target from Bank Robbery.
    const protectionExpiry = Number(targetData.bankProtectionExpiresAt || 0);
    if (protectionExpiry > now) {
        const remaining = formatCooldown(protectionExpiry - now);
        return {
            type: 'blocked',
            embed: warningEmbed(
                '🛡️ Bank Robbery Blocked',
                `<@${targetUser.id}> is protected by **Bank Protection** for another **${remaining}**. The robbery cannot go ahead.`
            ),
        };
    }

    const targetSouls = Math.max(0, Number(targetData.wallet || 0));
    if (targetSouls < 500) {
        return {
            type: 'blocked',
            embed: warningEmbed(
                'Target Too Poor',
                `<@${targetUser.id}> needs at least **${SOULS} 500 Souls** to be worth robbing.`
            ),
        };
    }

    for (const player of players) {
        const data = playerData.get(player.id);
        const remaining = cooldownRemaining(data, now);

        if (remaining > 0) {
            return {
                type: 'blocked',
                embed: warningEmbed(
                    'Robbery Crew Blocked',
                    `<@${player.id}> is still on Bank Robbery cooldown for **${formatCooldown(remaining)}**.`
                ),
            };
        }
    }

    const isSuccessful = Math.random() < BASE_ROB_SUCCESS_CHANCE;

    if (!isSuccessful) {
        const results = [];

        for (const player of players) {
            const data = playerData.get(player.id);
            data.wallet = Math.max(0, Number(data.wallet || 0) - POLICE_FINE);

            // Store the 10-minute police cooldown using the existing lastRob field.
            data.lastRob = now - ROB_COOLDOWN + POLICE_COOLDOWN;

            await setEconomyData(client, guildId, player.id, data);
            results.push(`• <@${player.id}> — ${SOULS} **1,000 Souls fine**`);
        }

        const embed = buildUserErrorEmbed(
            'unknown',
            `The police caught the entire crew! Every robber was fined **${SOULS} 1,000 Souls** and cannot attempt another Bank Robbery for **10 minutes**.`,
            { titleOverride: '🚔 Robbery Failed — Police Caught You' }
        );

        embed.addFields({
            name: '👮 Police Penalty',
            value: results.join('\n'),
            inline: false,
        });

        return { type: 'failed', embed };
    }

    const totalReward = Math.floor(targetSouls * ROB_REWARD_PERCENTAGE);
    const share = Math.floor(totalReward / players.length);
    const distributed = share * players.length;

    if (share < 1) {
        return {
            type: 'blocked',
            embed: warningEmbed(
                'Robbery Too Small',
                'The target does not have enough Souls for this crew to receive a reward.'
            ),
        };
    }

    targetData.wallet = targetSouls - distributed;

    for (const player of players) {
        const data = playerData.get(player.id);
        data.wallet = Number(data.wallet || 0) + share;
        data.lastRob = now;
        await setEconomyData(client, guildId, player.id, data);
    }

    await setEconomyData(client, guildId, targetUser.id, targetData);

    let rareShardWinner = null;
    if (Math.random() < RARE_SHARD_CHANCE) {
        rareShardWinner = players[Math.floor(Math.random() * players.length)];
        const winnerData = playerData.get(rareShardWinner.id);
        winnerData.shards = Number(winnerData.shards || 0) + 1;
        await setEconomyData(client, guildId, rareShardWinner.id, winnerData);
    }

    const embed = successEmbed(
        '🏦 Bank Robbery Successful',
        `The crew successfully robbed **${SOULS} ${fmt(distributed)} Souls** from <@${targetUser.id}>!`
    );

    embed.addFields(
        {
            name: '👥 Crew',
            value: players.map(player => `<@${player.id}>`).join(', '),
            inline: false,
        },
        {
            name: '💰 Reward Per Player',
            value: `${SOULS} **${fmt(share)} Souls**`,
            inline: true,
        },
        {
            name: '🎯 Target Lost',
            value: `${SOULS} **${fmt(distributed)} Souls**`,
            inline: true,
        },
        {
            name: '⏱️ Next Robbery',
            value: '**4 hours**`,
            inline: true,
        },
    );

    if (rareShardWinner) {
        embed.addFields({
            name: '💎 Rare Robbery',
            value: `**5% chance!** <@${rareShardWinner.id}> found **1 ${SHARD} Shard** during the robbery.`,
            inline: false,
        });
    }

    embed.setFooter({
        text: 'The crew shared 80% of the target\'s Souls equally.',
    });

    return { type: 'success', embed };
}

export default {
    data: new SlashCommandBuilder()
        .setName('bankrob')
        .setDescription('Team up to rob another player\'s Souls.')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The player you want to rob.')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('players')
                .setDescription('Total number of robbers, including you.')
                .setMinValue(2)
                .setMaxValue(10)
                .setRequired(true)
        ),

    category: 'Games',

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const targetUser = interaction.options.getUser('target', true);
        const targetCount = interaction.options.getInteger('players', true);
        const initiator = interaction.user;
        const guildId = interaction.guildId;
        const lobbyKey = `${guildId}:${initiator.id}`;

        if (targetUser.id === initiator.id) {
            throw createError(
                'Cannot rob self',
                ErrorTypes.VALIDATION,
                'You cannot target yourself.'
            );
        }

        if (targetUser.bot) {
            throw createError(
                'Cannot rob bot',
                ErrorTypes.VALIDATION,
                'Bots cannot be targeted by Bank Robbery.'
            );
        }

        if (activeLobbies.has(lobbyKey)) {
            throw createError(
                'Bank Robbery lobby already active',
                ErrorTypes.RATE_LIMIT,
                'You already have an active Bank Robbery lobby.'
            );
        }

        const initiatorData = await getEconomyData(client, guildId, initiator.id);
        const now = Date.now();
        const remaining = cooldownRemaining(initiatorData, now);

        if (remaining > 0) {
            throw createError(
                'Robbery cooldown active',
                ErrorTypes.RATE_LIMIT,
                `You need to lay low for another **${formatCooldown(remaining)}**.`
            );
        }

        const targetData = await getEconomyData(client, guildId, targetUser.id);
        const protectionExpiry = Number(targetData?.bankProtectionExpiresAt || 0);

        if (protectionExpiry > now) {
            throw createError(
                'Bank protection active',
                ErrorTypes.VALIDATION,
                `<@${targetUser.id}> has active **Bank Protection** for another **${formatCooldown(protectionExpiry - now)}**.`
            );
        }

        const targetSouls = Number(targetData?.wallet || 0);
        if (targetSouls < 500) {
            throw createError(
                'Victim too poor',
                ErrorTypes.VALIDATION,
                `<@${targetUser.id}> needs at least **${SOULS} 500 Souls** to be worth robbing.`
            );
        }

        activeLobbies.add(lobbyKey);

        const players = [initiator];
        const lobbyId = token();

        const joinButton = new ButtonBuilder()
            .setCustomId(`bankrob_join_${lobbyId}`)
            .setLabel('Join Robbery')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`bankrob_cancel_${lobbyId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(joinButton, cancelButton);

        try {
            const message = await interaction.editReply({
                content: lobbyText(initiator, targetUser, targetCount, players),
                components: [row],
            });

            const collector = message.createMessageComponentCollector({
                time: LOBBY_TIMEOUT,
                filter: component =>
                    component.customId === `bankrob_join_${lobbyId}` ||
                    component.customId === `bankrob_cancel_${lobbyId}`,
            });

            const result = await new Promise(resolve => {
                collector.on('collect', async component => {
                    if (component.customId === `bankrob_cancel_${lobbyId}`) {
                        if (component.user.id !== initiator.id) {
                            await component.reply({
                                content: '❌ Only the robbery leader can cancel this lobby.',
                                ephemeral: true,
                            }).catch(() => {});
                            return;
                        }

                        await component.deferUpdate().catch(() => {});
                        collector.stop('cancelled');
                        return;
                    }

                    if (component.user.bot) {
                        await component.reply({
                            content: '❌ Bots cannot join Bank Robbery.',
                            ephemeral: true,
                        }).catch(() => {});
                        return;
                    }

                    if (component.user.id === targetUser.id) {
                        await component.reply({
                            content: '❌ The target cannot join their own robbery.',
                            ephemeral: true,
                        }).catch(() => {});
                        return;
                    }

                    if (players.some(player => player.id === component.user.id)) {
                        await component.reply({
                            content: '❌ You are already in this robbery.',
                            ephemeral: true,
                        }).catch(() => {});
                        return;
                    }

                    if (players.length >= targetCount) {
                        await component.reply({
                            content: '❌ This robbery crew is already full.',
                            ephemeral: true,
                        }).catch(() => {});
                        return;
                    }

                    const joiningData = await getEconomyData(client, guildId, component.user.id);
                    const joiningRemaining = cooldownRemaining(joiningData, Date.now());

                    if (joiningRemaining > 0) {
                        await component.reply({
                            content: `❌ You are on Bank Robbery cooldown for **${formatCooldown(joiningRemaining)}**.`,
                            ephemeral: true,
                        }).catch(() => {});
                        return;
                    }

                    players.push(component.user);
                    await component.reply({
                        content: '✅ You joined the Bank Robbery crew.',
                        ephemeral: true,
                    }).catch(() => {});

                    if (players.length >= targetCount) {
                        collector.stop('ready');
                        return;
                    }

                    await interaction.editReply({
                        content: lobbyText(initiator, targetUser, targetCount, players),
                        components: [row],
                    }).catch(() => {});
                });

                collector.on('end', async (_collected, reason) => {
                    await interaction.editReply({ components: [] }).catch(() => {});
                    resolve({
                        ready: reason === 'ready' && players.length === targetCount,
                        cancelled: reason === 'cancelled',
                    });
                });
            });

            if (!result.ready) {
                await interaction.editReply({
                    content: result.cancelled
                        ? '❌ Bank Robbery cancelled.'
                        : `⌛ Bank Robbery lobby expired. **${players.length}/${targetCount}** robbers joined.`,
                    components: [],
                }).catch(() => {});
                return;
            }

            const outcome = await runRobbery(interaction, client, targetUser, players);

            await InteractionHelper.safeEditReply(interaction, {
                content: '',
                embeds: [outcome.embed],
                components: [],
            });
        } finally {
            activeLobbies.delete(lobbyKey);
        }
    }, { command: 'bankrob' }),
};
