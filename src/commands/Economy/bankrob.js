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
import { BotConfig, isBotOwner } from '../../config/bot.js';

const SOULS = '<:Souls:1547510037621112894>';
const SHARD = '<:Shard:1548962748321374218>';

const ROB_COOLDOWN = BotConfig.economy?.cooldowns?.rob ?? 4 * 60 * 60 * 1000;
const BASE_ROB_SUCCESS_CHANCE = BotConfig.economy?.robSuccessRate ?? 0.4;
const ROB_REWARD_PERCENTAGE = 0.80;
const POLICE_FINE = 1000;
const POLICE_COOLDOWN = 10 * 60 * 1000;
const RARE_SHARD_CHANCE = 0.05;
const LOBBY_TIMEOUT = 60 * 1000;

function fmt(amount) {
    return Number(amount || 0).toLocaleString();
}

function cooldownRemaining(userData, now = Date.now(), userId = null) {
    if (userId && isBotOwner(userId)) return 0;

    // Bank Robbery uses its own cooldown so it does not interfere with
    // any other robbery/economy command.
    const bankRobCooldown = Number(userData?.bankRobCooldownExpiresAt || 0);
    if (bankRobCooldown > now) {
        return bankRobCooldown - now;
    }

    return 0;
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
        const remaining = cooldownRemaining(data, now, player.id);

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

            // Police penalty: 1,000 Souls + exactly 10 minutes Bank Robbery cooldown.
            if (!isBotOwner(player.id)) {
                data.bankRobCooldownExpiresAt = now + POLICE_COOLDOWN;
            }

            await setEconomyData(client, guildId, player.id, data);
            results.push(`• <@${player.id}> — ${SOULS} **1,000 Souls fine**`);
        }

        const embed = buildUserErrorEmbed(
            'unknown',
            `The police caught the entire crew! **Every robber loses 1,000 Souls**. Non-owner robbers also receive a **10-minute Bank Robbery cooldown**.`,
            { titleOverride: '🚔 ROBBERY FAILED — POLICE CAUGHT YOU!' }
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
        // Successful robbery: normal 4-hour Bank Robbery cooldown.
        if (!isBotOwner(player.id)) {
            data.bankRobCooldownExpiresAt = now + ROB_COOLDOWN;
        }
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
            value: players.some(player => isBotOwner(player.id))
                ? '**No cooldown for Owner**\\n**4 hours for other robbers**'
                : '**4 hours**',
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
        .addUserOption(option =>
            option
                .setName('player2')
                .setDescription('The second robber.')
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName('player3')
                .setDescription('The third robber (optional).')
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('player4')
                .setDescription('The fourth robber (optional).')
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('player5')
                .setDescription('The fifth robber (optional).')
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('player6')
                .setDescription('The sixth robber (optional).')
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('player7')
                .setDescription('The seventh robber (optional).')
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('player8')
                .setDescription('The eighth robber (optional).')
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('player9')
                .setDescription('The ninth robber (optional).')
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('player10')
                .setDescription('The tenth robber (optional).')
                .setRequired(false)
        ),

    category: 'Games',

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const targetUser = interaction.options.getUser('target', true);
        const initiator = interaction.user;
        const guildId = interaction.guildId;

        const selectedPlayers = ['player2', 'player3', 'player4', 'player5', 'player6', 'player7', 'player8', 'player9', 'player10']
            .map(name => interaction.options.getUser(name))
            .filter(Boolean);

        const players = [initiator, ...selectedPlayers];
        const targetCount = players.length;

        // Validate every explicitly selected robber before starting.
        const uniquePlayerIds = new Set(players.map(player => player.id));
        if (uniquePlayerIds.size !== players.length) {
            throw createError(
                'Duplicate robber selected',
                ErrorTypes.VALIDATION,
                'Each robber must be a different user.'
            );
        }

        const invalidPlayer = players.find(player => player.id === targetUser.id);
        if (invalidPlayer) {
            throw createError(
                'Target selected as robber',
                ErrorTypes.VALIDATION,
                'The target cannot also be one of the robbers.'
            );
        }

        const botPlayer = players.find(player => player.bot);
        if (botPlayer) {
            throw createError(
                'Bot selected as robber',
                ErrorTypes.VALIDATION,
                'Bots cannot be part of a Bank Robbery crew.'
            );
        }

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

        const initiatorData = await getEconomyData(client, guildId, initiator.id);
        const now = Date.now();
        const remaining = cooldownRemaining(initiatorData, now, initiator.id);

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

        try {
            await interaction.editReply({
                content: lobbyText(initiator, targetUser, targetCount, players),
                components: [],
            });

            const outcome = await runRobbery(interaction, client, targetUser, players);

            await InteractionHelper.safeEditReply(interaction, {
                content: '',
                embeds: [outcome.embed],
                components: [],
            });
        }
    }, { command: 'bankrob' }),
};
