import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { tryAwardGameShard } from '../../services/gacha/gameShardDrop.js';

const SOULS = '<:Souls:1547510037621112894>';
const TAILS = '<:Tails:1549019689022132315>';
const TOTAL = '<:Total:1547545479628333086>';
const SHARD = '<:Shard:1548962748321374218>';
const ENTRY_RPS = 300;
const ENTRY_COIN = 900;

function fmt(n) { return Number(n || 0).toLocaleString(); }
function token() { return Math.random().toString(36).slice(2, 10); }

async function wallet(client, guildId, userId) { return getEconomyData(client, guildId, userId); }
async function save(client, guildId, userId, data) { await setEconomyData(client, guildId, userId, data); }

async function refundPlayers(client, guildId, players, amountOrMap) {
    for (const player of players) {
        const amount = typeof amountOrMap === 'number'
            ? amountOrMap
            : Number(amountOrMap.get(player.id) || 0);
        if (amount <= 0) continue;
        const data = await wallet(client, guildId, player.id);
        data.wallet = Number(data.wallet || 0) + amount;
        await save(client, guildId, player.id, data);
    }
}

async function payWinners(client, guildId, winners, amount) {
    const shardWinners = [];

    for (const winner of winners) {
        const data = await wallet(client, guildId, winner.id);
        data.wallet = Number(data.wallet || 0) + amount;
        await save(client, guildId, winner.id, data);

        if (await tryAwardGameShard(client, guildId, winner.id)) {
            shardWinners.push(winner);
        }
    }

    return shardWinners;
}

async function channelInvite(interaction, players, gameName) {
    const id = token();
    const accepted = new Set([interaction.user.id]);
    let rejectedUser = null;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pvp_join_${id}`).setLabel('Join Match').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`pvp_reject_${id}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
    );

    const message = await interaction.editReply({
        content: `🎮 **${interaction.user.username}** started a **${gameName}** match.\n\n${players.slice(1).map(p => `• <@${p.id}> — waiting`).join('\n')}\n\n**Join directly here. You have 60 seconds.**`,
        components: [row]
    });

    const collector = message.createMessageComponentCollector({
        time: 60_000,
        filter: component => players.some(player => player.id === component.user.id)
    });

    return new Promise(resolve => {
        collector.on('collect', async component => {
            const player = players.find(p => p.id === component.user.id);
            if (!player || player.id === interaction.user.id) {
                await component.reply({ content: 'You are already in this match.', ephemeral: true }).catch(() => {});
                return;
            }

            if (component.customId === `pvp_reject_${id}`) {
                rejectedUser = player;
                await component.reply({ content: `❌ You rejected the **${gameName}** match.`, ephemeral: true }).catch(() => {});
                collector.stop('rejected');
                return;
            }

            if (accepted.has(player.id)) {
                await component.reply({ content: '✅ You already joined.', ephemeral: true }).catch(() => {});
                return;
            }

            accepted.add(player.id);
            await component.reply({ content: `✅ You joined **${gameName}**.`, ephemeral: true }).catch(() => {});

            if (accepted.size === players.length) {
                collector.stop('accepted');
            } else {
                await interaction.editReply({
                    content: `🎮 **${gameName}**\n\n${players.slice(1).map(p => `• <@${p.id}> — ${accepted.has(p.id) ? '✅ Joined' : '⏳ Waiting'}`).join('\n')}\n\nWaiting for the remaining players...`,
                    components: [row]
                }).catch(() => {});
            }
        });

        collector.on('end', async (_collected, reason) => {
            await interaction.editReply({ components: [] }).catch(() => {});
            if (rejectedUser) return resolve({ ok: false, reason: 'rejected', user: rejectedUser });
            if (reason === 'accepted' || accepted.size === players.length) return resolve({ ok: true });
            resolve({ ok: false, reason: 'timeout' });
        });
    });
}

async function collectChoiceInChannel(interaction, players, title, options, prefix) {
    const id = token();
    const choices = new Map();

    const row = new ActionRowBuilder().addComponents(
        ...options.map(option => new ButtonBuilder()
            .setCustomId(`${prefix}_${id}_${option.value}`)
            .setLabel(option.label)
            .setStyle(ButtonStyle.Primary))
    );

    await interaction.editReply({
        content: `🎮 **${title}**\n\n${players.map(p => `• <@${p.id}> — ⏳ Choosing...`).join('\n')}\n\nMake your choice below.`,
        components: [row]
    });

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
        time: 60_000,
        filter: component => players.some(player => player.id === component.user.id)
    });

    return new Promise(resolve => {
        collector.on('collect', async component => {
            if (choices.has(component.user.id)) {
                await component.reply({ content: '❌ Your choice is already locked.', ephemeral: true }).catch(() => {});
                return;
            }

            const player = players.find(p => p.id === component.user.id);
            if (!player) return;

            choices.set(player.id, component.customId.split('_').pop());
            await component.reply({ content: `✅ Your choice for **${title}** is locked.`, ephemeral: true }).catch(() => {});

            if (choices.size === players.length) collector.stop('complete');
            else {
                await interaction.editReply({
                    content: `🎮 **${title}**\n\n${players.map(p => `• <@${p.id}> — ${choices.has(p.id) ? '✅ Locked' : '⏳ Choosing...'}`).join('\n')}\n\nWaiting for the remaining players...`,
                    components: [row]
                }).catch(() => {});
            }
        });

        collector.on('end', async (_collected, reason) => {
            await interaction.editReply({ components: [] }).catch(() => {});
            resolve({ complete: reason === 'complete' && choices.size === players.length, choices });
        });
    });
}

async function collectNumberBets(interaction, players) {
    const id = token();
    const choices = new Map();
    const bets = new Map();

    const row = new ActionRowBuilder().addComponents(
        ...['1', '2', '3', '4'].map(number => new ButtonBuilder()
            .setCustomId(`pvp_number_${id}_${number}`)
            .setLabel(number)
            .setStyle(ButtonStyle.Primary))
    );

    await interaction.editReply({
        content: `🎯 **NUMBER GUESS — 1 to 4**\n\n${players.map(p => `• <@${p.id}> — ⏳ Choose a number`).join('\n')}\n\nAfter choosing, you will enter your **own Souls bet**.`,
        components: [row]
    });

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
        time: 60_000,
        filter: component => players.some(player => player.id === component.user.id)
    });

    return new Promise(resolve => {
        collector.on('collect', async button => {
            if (choices.has(button.user.id)) {
                await button.reply({ content: '❌ Your number and bet are already locked.', ephemeral: true }).catch(() => {});
                return;
            }

            const number = button.customId.split('_').pop();
            const modalId = `pvp_bet_${id}_${button.user.id}`;
            const modal = new ModalBuilder().setCustomId(modalId).setTitle('Choose Your Souls Bet');
            const input = new TextInputBuilder()
                .setCustomId('bet_amount')
                .setLabel('How many Souls do you want to bet?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Example: 100')
                .setMinLength(1)
                .setMaxLength(10)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await button.showModal(modal);

            const submitted = await button.awaitModalSubmit({
                time: 60_000,
                filter: modalInteraction => modalInteraction.user.id === button.user.id && modalInteraction.customId === modalId
            }).catch(() => null);

            if (!submitted) return;

            const amount = Number(submitted.fields.getTextInputValue('bet_amount'));
            if (!Number.isInteger(amount) || amount < 1) {
                await submitted.reply({ content: '❌ Your bet must be a whole number greater than 0.', ephemeral: true }).catch(() => {});
                return;
            }

            choices.set(button.user.id, number);
            bets.set(button.user.id, amount);
            await submitted.reply({ content: `✅ Locked **${number}** with a **${fmt(amount)} Souls** bet.`, ephemeral: true }).catch(() => {});

            if (choices.size === players.length) collector.stop('complete');
        });

        collector.on('end', async (_collected, reason) => {
            await interaction.editReply({ components: [] }).catch(() => {});
            resolve({ complete: reason === 'complete' && choices.size === players.length, choices, bets });
        });
    });
}

function rpsWinners(players, choices) {
    const unique = [...new Set([...choices.values()])];
    if (unique.length === 1 || unique.length === 3) return [];
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const winningChoice = unique.find(choice => unique.some(other => beats[choice] === other));
    return players.filter(player => choices.get(player.id) === winningChoice);
}

export default {
    data: new SlashCommandBuilder()
        .setName('pvp')
        .setDescription('Create a PvP multiplayer match with other players.')
        .addStringOption(option => option
            .setName('game')
            .setDescription('Choose the PvP game')
            .setRequired(true)
            .addChoices(
                { name: 'Rock Paper Scissors — 2 or 3 Players — 300 Souls', value: 'rps' },
                { name: 'Heads & Tails — 2 Players — 900 Souls', value: 'coin' },
                { name: 'Number Guess — 4 Players — Individual Bets', value: 'number' }
            )
        )
        .addUserOption(option => option.setName('player1').setDescription('Player 1').setRequired(true))
        .addUserOption(option => option.setName('player2').setDescription('Player 2').setRequired(true))
        .addUserOption(option => option.setName('player3').setDescription('Player 3 — required for RPS 3-player / Number Guess').setRequired(false)),

    async execute(interaction, config, client) {
        const game = interaction.options.getString('game', true);
        const users = [
            interaction.user,
            interaction.options.getUser('player1'),
            interaction.options.getUser('player2'),
            interaction.options.getUser('player3')
        ].filter(Boolean);
        const players = [...new Map(users.map(user => [user.id, user])).values()];

        if (players.some(player => player.bot)) {
            return interaction.reply({ content: '❌ Bots cannot join PvP matches.', ephemeral: true });
        }

        const required = game === 'number' ? 4 : game === 'rps' ? (players.length === 3 ? 3 : 2) : 2;
        if (players.length !== required) {
            return interaction.reply({ content: `❌ This mode requires exactly **${required} players**.`, ephemeral: true });
        }

        const entry = game === 'rps' ? ENTRY_RPS : game === 'coin' ? ENTRY_COIN : 0;
        const gameName = game === 'rps' ? 'Rock Paper Scissors' : game === 'coin' ? 'Heads & Tails' : 'Number Guess';

        await interaction.deferReply();
        const invite = await channelInvite(interaction, players, gameName);

        if (!invite.ok) {
            if (invite.reason === 'rejected') return interaction.editReply(`❌ <@${invite.user.id}> rejected the match. **Match cancelled.**`);
            return interaction.editReply('⏰ Not everyone joined within 60 seconds. **Match cancelled.**');
        }

        const guildId = interaction.guildId;

        if (game === 'number') {
            const result = await collectNumberBets(interaction, players);
            if (!result.complete) return interaction.editReply('⏰ Someone did not submit a valid number and bet in time. **No Souls were charged. Match cancelled.**');

            for (const player of players) {
                const data = await wallet(client, guildId, player.id);
                const bet = Number(result.bets.get(player.id) || 0);
                if (Number(data.wallet || 0) < bet) {
                    return interaction.editReply(`❌ <@${player.id}> does not have enough ${SOULS} for their **${fmt(bet)} Souls** bet. **No bets were charged. Match cancelled.**`);
                }
            }

            let pot = 0;
            for (const player of players) {
                const data = await wallet(client, guildId, player.id);
                const bet = Number(result.bets.get(player.id) || 0);
                data.wallet -= bet;
                await save(client, guildId, player.id, data);
                pot += bet;
            }

            const secret = String(Math.floor(Math.random() * 4) + 1);
            const winners = players.filter(player => result.choices.get(player.id) === secret);

            if (!winners.length) {
                await refundPlayers(client, guildId, players, result.bets);
                return interaction.editReply(`🎯 The number was **${secret}**. Nobody guessed correctly. **All individual bets refunded.**`);
            }

            const share = Math.floor(pot / winners.length);
            const shardWinners = await payWinners(client, guildId, winners, share);
            return interaction.editReply(`🎯 **NUMBER GUESS COMPLETE!**\nThe number was **${secret}**.\nWinner${winners.length > 1 ? 's' : ''}: ${winners.map(player => `<@${player.id}>`).join(', ')}\n${SOULS} **${fmt(share)} Souls** paid to each winner from the **${fmt(pot)} Souls** total pot.${shardWinners.length ? `\n${SHARD} **1 Shard bonus:** ${shardWinners.map(player => `<@${player.id}>`).join(', ')}` : ''}`);
        }

        const charged = [];
        for (const player of players) {
            const data = await wallet(client, guildId, player.id);
            if (Number(data.wallet || 0) < entry) return interaction.editReply(`❌ <@${player.id}> does not have enough ${SOULS} for the **${fmt(entry)} Souls** entry fee. **Match cancelled.**`);
            charged.push([player, data]);
        }
        for (const [player, data] of charged) {
            data.wallet -= entry;
            await save(client, guildId, player.id, data);
        }

        const pot = entry * players.length;

        if (game === 'rps') {
            const result = await collectChoiceInChannel(interaction, players, 'Rock Paper Scissors', [
                { label: '🪨 Rock', value: 'rock' },
                { label: '📄 Paper', value: 'paper' },
                { label: '✂️ Scissors', value: 'scissors' }
            ], 'pvp_rps');

            if (!result.complete) {
                await refundPlayers(client, guildId, players, entry);
                return interaction.editReply('⏰ Someone did not choose in time. **Entry fees refunded and match cancelled.**');
            }

            const winners = rpsWinners(players, result.choices);
            if (!winners.length) {
                await refundPlayers(client, guildId, players, entry);
                return interaction.editReply('🤝 **RPS DRAW!** Everyone tied. Entry fees refunded.');
            }

            const share = Math.floor(pot / winners.length);
            const shardWinners = await payWinners(client, guildId, winners, share);
            return interaction.editReply(`🏆 **RPS MATCH COMPLETE!**\n\nWinner${winners.length > 1 ? 's' : ''}: ${winners.map(player => `<@${player.id}>`).join(', ')}\n${SOULS} **${fmt(share)} Souls** paid to each winner.\n${TOTAL} Pot: **${fmt(pot)} Souls**.${shardWinners.length ? `\n${SHARD} **1 Shard bonus:** ${shardWinners.map(player => `<@${player.id}>`).join(', ')}` : ''}`);
        }

        const result = await collectChoiceInChannel(interaction, players, 'Heads & Tails', [
            { label: 'Heads', value: 'heads' },
            { label: 'Tails', value: 'tails' }
        ], 'pvp_coin');

        if (!result.complete) {
            await refundPlayers(client, guildId, players, entry);
            return interaction.editReply('⏰ A player did not choose in time. **Entry fees refunded.**');
        }

        const flip = Math.random() < 0.5 ? 'heads' : 'tails';
        const winners = players.filter(player => result.choices.get(player.id) === flip);

        if (!winners.length) {
            await refundPlayers(client, guildId, players, entry);
            return interaction.editReply(`${flip === 'heads' ? SOULS : TAILS} **${flip.toUpperCase()}!**\n\nBoth players chose the opposite side. **Draw — entry fees refunded.**`);
        }

        const share = Math.floor(pot / winners.length);
        const shardWinners = await payWinners(client, guildId, winners, share);
        return interaction.editReply(`${flip === 'heads' ? SOULS : TAILS} **${flip.toUpperCase()}!**\n\nWinner: ${winners.map(player => `<@${player.id}>`).join(', ')}\n${SOULS} **${fmt(share)} Souls** won from the **${fmt(pot)} Souls** pot.${shardWinners.length ? `\n${SHARD} **1 Shard bonus:** ${shardWinners.map(player => `<@${player.id}>`).join(', ')}` : ''}`);
    }
};
