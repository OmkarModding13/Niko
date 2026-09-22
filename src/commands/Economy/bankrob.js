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

const activeLobbies = new Map();

function fmt(amount) {
    return Number(amount || 0).toLocaleString();
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function cooldownRemaining(userData, now = Date.now(), userId = null) {
    if (userId && isBotOwner(userId)) return 0;
    const expiry = Number(userData?.bankRobCooldownExpiresAt || 0);
    return Math.max(0, expiry - now);
}

function lobbyText(target, targetCount, players) {
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

async function saveEconomyDataOrThrow(client, guildId, userId, data) {
    const saved = await setEconomyData(client, guildId, userId, data);
    if (!saved) {
        throw createError(
            'Economy save failed',
            ErrorTypes.DATABASE,
            'The robbery could not be saved safely. No further rewards were processed.'
        );
    }
}

async function resolveRobbery(interaction, client, targetUser, players) {
    const guildId = interaction.guildId;
    const now = Date.now();

    const targetData = await getEconomyData(client, guildId, targetUser.id);
    if (!targetData) {
        throw createError(
            'Failed to load target economy',
            ErrorTypes.DATABASE,
            'Failed to load the target economy data. Please try again.'
        );
    }

    if (targetUser.id === interaction.guild?.ownerId) {
        return {
            type: 'blocked',
            embed: warningEmbed(
        '😈 OHOHO! KISKI AUKAAT?',
                `**Hollow Devil ko lootne aaya?** 💀

Plan: **10/10**
Result: **GALAT DARWAAZA, BHAI.** 🚪💀

🚫 **Bank Robbery cancelled.** Hollow Devil ka bank lootna itna easy nahi hai, bhai. 😈`
            ),
        };
    }

    const playerData = new Map();
    for (const player of players) {
        const data = await getEconomyData(client, guildId, player.id);
        if (!data) {
            throw createError(
                'Failed to load crew economy',
                ErrorTypes.DATABASE,
                `Failed to load <@${player.id}>'s economy data. The robbery was cancelled before rewards were applied.`
            );
        }
        playerData.set(player.id, data);
    }

    const protectionExpiry = Number(targetData.bankProtectionExpiresAt || 0);
    if (protectionExpiry > now) {
        return {
            type: 'blocked',
            embed: warningEmbed(
                '🛡️ Bank Robbery Blocked',
                `<@${targetUser.id}> is protected by **Bank Protection** for another **${formatDuration(protectionExpiry - now)}**. No Souls were stolen.`
            ),
        };
    }

    const targetSouls = Math.max(0, Number(targetData.bank || 0));
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
        const remaining = cooldownRemaining(playerData.get(player.id), now, player.id);
        if (remaining > 0) {
            return {
                type: 'blocked',
                embed: warningEmbed(
                    'Robbery Crew Blocked',
                    `<@${player.id}> is still on Bank Robbery cooldown for **${formatDuration(remaining)}**.`
                ),
            };
        }
    }

    if (Math.random() >= BASE_ROB_SUCCESS_CHANCE) {
        for (const player of players) {
            const data = playerData.get(player.id);
            data.wallet = Math.max(0, Number(data.wallet || 0) - POLICE_FINE);
            if (!isBotOwner(player.id)) {
                data.bankRobCooldownExpiresAt = now + POLICE_COOLDOWN;
            }
            await saveEconomyDataOrThrow(client, guildId, player.id, data);
        }

        const embed = buildUserErrorEmbed(
            'unknown',
            'The police caught the entire crew! **Every robber loses 1,000 Souls**. Non-owner robbers also receive a **10-minute Bank Robbery cooldown**.',
            { titleOverride: '🚔 ROBBERY FAILED — POLICE CAUGHT YOU!' }
        );

        embed.addFields({
            name: '👮 Police Penalty',
            value: players
                .map(player => `• <@${player.id}> — ${SOULS} **1,000 Souls fine**`)
                .join('\n'),
            inline: false,
        });

        return { type: 'failed', embed };
    }

    const totalReward = Math.floor(targetSouls * ROB_REWARD_PERCENTAGE);
    const baseShare = Math.floor(totalReward / players.length);
    const remainder = totalReward % players.length;

    if (baseShare < 1) {
        return {
            type: 'blocked',
            embed: warningEmbed(
                'Robbery Too Small',
                'The target does not have enough Souls for this crew to receive a reward.'
            ),
        };
    }

    targetData.bank = targetSouls - totalReward;

    for (let index = 0; index < players.length; index += 1) {
        const player = players[index];
        const data = playerData.get(player.id);
        const share = baseShare + (index < remainder ? 1 : 0);

        data.wallet = Number(data.wallet || 0) + share;
        if (!isBotOwner(player.id)) {
            data.bankRobCooldownExpiresAt = now + ROB_COOLDOWN;
        }

        await saveEconomyDataOrThrow(client, guildId, player.id, data);
    }

    await saveEconomyDataOrThrow(client, guildId, targetUser.id, targetData);

    let rareShardWinner = null;
    if (Math.random() < RARE_SHARD_CHANCE) {
        rareShardWinner = players[Math.floor(Math.random() * players.length)];
        const winnerData = playerData.get(rareShardWinner.id);
        winnerData.shards = Number(winnerData.shards || 0) + 1;
        await saveEconomyDataOrThrow(client, guildId, rareShardWinner.id, winnerData);
    }

    const embed = successEmbed(
        '🏦 Bank Robbery Successful',
        `The crew successfully robbed **${SOULS} ${fmt(totalReward)} Souls** from <@${targetUser.id}>'s bank!`
    );

    embed.addFields(
        {
            name: '👥 Crew',
            value: players.map(player => `<@${player.id}>`).join(', '),
            inline: false,
        },
        {
            name: '💰 Reward Per Player',
            value: `${SOULS} **${fmt(baseShare)} Souls each**${remainder > 0 ? ` (+1 Soul to ${remainder} crew member${remainder === 1 ? '' : 's'})` : ''}.`,
            inline: true,
        },
        {
            name: '🎯 Target Lost',
            value: `${SOULS} **${fmt(totalReward)} Souls**`,
            inline: true,
        },
        {
            name: '⏱️ Next Robbery',
            value: players.some(player => isBotOwner(player.id))
                ? '**No cooldown for Owner**\n**4 hours for other robbers**'
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
        text: 'The crew shared exactly 80% of the target\'s Souls.',
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

        if (targetUser.id === initiator.id) {
            throw createError('Cannot rob self', ErrorTypes.VALIDATION, 'You cannot target yourself.');
        }

        if (targetUser.bot) {
            throw createError('Cannot rob bot', ErrorTypes.VALIDATION, 'Bots cannot be targeted by Bank Robbery.');
        }

        if (activeLobbies.has(initiator.id)) {
            throw createError(
                'Robbery already active',
                ErrorTypes.RATE_LIMIT,
                'You already have an active Bank Robbery lobby.'
            );
        }

        const initiatorData = await getEconomyData(client, guildId, initiator.id);
        const initiatorCooldown = cooldownRemaining(initiatorData, Date.now(), initiator.id);
        if (initiatorCooldown > 0) {
            throw createError(
                'Robbery cooldown active',
                ErrorTypes.RATE_LIMIT,
                `You need to lay low for another **${formatDuration(initiatorCooldown)}**.`
            );
        }

        const lobbyId = `${guildId}:${initiator.id}:${Date.now()}`;
        const players = [initiator];
        activeLobbies.set(initiator.id, lobbyId);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`bankrob_join:${lobbyId}`)
                .setLabel('Join Robbery')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`bankrob_cancel:${lobbyId}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        try {
            const message = await interaction.editReply({
                content: lobbyText(targetUser, targetCount, players),
                components: [row],
            });

            const collector = message.createMessageComponentCollector({
                time: LOBBY_TIMEOUT,
            });

            let finished = false;

            const finish = async (outcome) => {
                if (finished) return;
                finished = true;
                for (const player of players) {
                    if (activeLobbies.get(player.id) === lobbyId) {
                        activeLobbies.delete(player.id);
                    }
                }
                collector.stop('finished');
                await InteractionHelper.safeEditReply(interaction, {
                    content: '',
                    embeds: outcome?.embed ? [outcome.embed] : [],
                    components: [],
                });
            };

            collector.on('collect', async component => {
                if (finished) return;

                if (component.user.bot) {
                    await component.reply({
                        content: '❌ Bots cannot join a Bank Robbery.',
                        ephemeral: true,
                    }).catch(() => {});
                    return;
                }

                if (component.customId === `bankrob_cancel:${lobbyId}`) {
                    if (component.user.id !== initiator.id) {
                        await component.reply({
                            content: '❌ Only the robbery leader can cancel this lobby.',
                            ephemeral: true,
                        }).catch(() => {});
                        return;
                    }

                    await component.reply({
                        content: '❌ Robbery cancelled.',
                        ephemeral: true,
                    }).catch(() => {});

                    await finish({
                        embed: warningEmbed(
                            '🏦 Robbery Cancelled',
                            'The robbery leader cancelled the Bank Robbery.'
                        ),
                    });
                    return;
                }

                if (component.customId !== `bankrob_join:${lobbyId}`) return;

                if (component.user.id === targetUser.id) {
                    await component.reply({
                        content: '❌ The target cannot join their own robbery.',
                        ephemeral: true,
                    }).catch(() => {});
                    return;
                }

                if (players.some(player => player.id === component.user.id)) {
                    await component.reply({
                        content: '✅ You are already in the crew.',
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

                const joinerData = await getEconomyData(client, guildId, component.user.id);
                const joinerCooldown = cooldownRemaining(joinerData, Date.now(), component.user.id);

                if (joinerCooldown > 0) {
                    await component.reply({
                        content: `❌ You are on Bank Robbery cooldown for **${formatDuration(joinerCooldown)}**.`,
                        ephemeral: true,
                    }).catch(() => {});
                    return;
                }

                if (activeLobbies.has(component.user.id)) {
                    await component.reply({
                        content: '❌ You are already leading another Bank Robbery.',
                        ephemeral: true,
                    }).catch(() => {});
                    return;
                }

                players.push(component.user);
                activeLobbies.set(component.user.id, lobbyId);

                await component.reply({
                    content: '✅ You joined the Bank Robbery crew.',
                    ephemeral: true,
                }).catch(() => {});

                if (players.length >= targetCount) {
                    try {
                        const outcome = await resolveRobbery(interaction, client, targetUser, players);
                        await finish(outcome);
                    } catch (error) {
                        await finish({
                            embed: warningEmbed(
                                '❌ Robbery Error',
                                'The robbery could not be completed safely. No additional rewards were processed.'
                            ),
                        });
                        return;
                    }
                    return;
                }

                await InteractionHelper.safeEditReply(interaction, {
                    content: lobbyText(targetUser, targetCount, players),
                    components: [row],
                });
            });

            collector.on('end', async (_collected, reason) => {
                if (finished) return;

                finished = true;
                for (const player of players) {
                    if (activeLobbies.get(player.id) === lobbyId) {
                        activeLobbies.delete(player.id);
                    }
                }

                if (reason === 'time') {
                    await InteractionHelper.safeEditReply(interaction, {
                        content: '',
                        embeds: [
                            warningEmbed(
                                '⏰ Robbery Cancelled',
                                'Not enough robbers joined within **60 seconds**. No Souls were changed.'
                            ),
                        ],
                        components: [],
                    });
                }
            });
        } catch (error) {
            for (const player of players) {
                if (activeLobbies.get(player.id) === lobbyId) {
                    activeLobbies.delete(player.id);
                }
            }
            throw error;
        }
    }, { command: 'bankrob' }),
};
