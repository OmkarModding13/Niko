import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';

const SOULS = '<:Souls:1547510037621112894>';
const TAILS = '<:Tails:1549019689022132315>';
const TOTAL = '<:Total:1547545479628333086>';
const ENTRY_RPS = 300;
const ENTRY_COIN = 900;

function fmt(n) { return Number(n || 0).toLocaleString(); }
function uid() { return Math.random().toString(36).slice(2, 10); }

async function invitePlayers(interaction, players, gameName) {
    const token = uid();
    const results = new Map([[interaction.user.id, true]]);
    const uniquePlayers = [...new Map(players.map(p => [p.id, p])).values()]
        .filter(p => p.id !== interaction.user.id);

    const invites = uniquePlayers.map(async user => {
        try {
            const dm = await user.createDM();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pvp_accept_${token}`).setLabel('Join Match').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`pvp_reject_${token}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
            );
            const msg = await dm.send({
                content: `🎮 **${interaction.user.username}** invited you to a **${gameName}** match in **${interaction.guild.name}**.\n\nYou have **60 seconds** to respond.`,
                components: [row],
            });
            const choice = await msg.awaitMessageComponent({
                time: 60_000,
                filter: i => i.user.id === user.id && [
                    `pvp_accept_${token}`,
                    `pvp_reject_${token}`,
                ].includes(i.customId),
            }).catch(() => null);
            if (!choice) {
                results.set(user.id, false);
                return;
            }
            const accepted = choice.customId === `pvp_accept_${token}`;
            results.set(user.id, accepted);
            await choice.update({
                content: accepted ? `✅ You joined **${gameName}**.` : `❌ You rejected the **${gameName}** invitation.`,
                components: [],
            }).catch(() => {});
        } catch {
            results.set(user.id, false);
        }
    });

    await Promise.all(invites);
    return results;
}

async function getWallet(client, guildId, userId) {
    return getEconomyData(client, guildId, userId);
}

async function saveWallet(client, guildId, userId, data) {
    await setEconomyData(client, guildId, userId, data);
}

async function collectChoice(players, guildName, title, buttons, prefix) {
    const token = uid();
    const choices = new Map();
    await Promise.all(players.map(async player => {
        try {
            const dm = await player.createDM();
            const row = new ActionRowBuilder().addComponents(
                ...buttons.map(b => new ButtonBuilder()
                    .setCustomId(`${prefix}_${token}_${b.value}`)
                    .setLabel(b.label)
                    .setStyle(ButtonStyle.Primary))
            );
            const msg = await dm.send({
                content: `🎮 **${title}**\n${guildName}\nChoose your move within **60 seconds**.`,
                components: [row],
            });
            const i = await msg.awaitMessageComponent({
                time: 60_000,
                filter: x => x.user.id === player.id && x.customId.startsWith(`${prefix}_${token}_`),
            }).catch(() => null);
            if (i) {
                choices.set(player.id, i.customId.split('_').pop());
                await i.update({ content: `✅ Choice locked in for **${title}**.`, components: [] }).catch(() => {});
            }
        } catch {}
    }));
    return choices;
}

function rpsWinners(players, choices) {
    const unique = [...new Set([...choices.values()])];
    if (unique.length === 1 || unique.length === 3) return [];
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const winningChoice = unique.find(c => unique.some(other => beats[c] === other));
    return players.filter(p => choices.get(p.id) === winningChoice);
}

export default {
    data: new SlashCommandBuilder()
        .setName('pvp')
        .setDescription('Create a PvP multiplayer match with other players.')
        .addStringOption(o => o.setName('game').setDescription('Choose the PvP game').setRequired(true).addChoices(
            { name: 'Rock Paper Scissors — 2 or 3 Players — 300 Souls', value: 'rps' },
            { name: 'Heads & Tails — 2 Players — 900 Souls', value: 'coin' },
            { name: 'Number Guess — 4 Players — Custom Bet', value: 'number' },
        ))
        .addUserOption(o => o.setName('player1').setDescription('Player 1').setRequired(true))
        .addUserOption(o => o.setName('player2').setDescription('Player 2').setRequired(true))
        .addUserOption(o => o.setName('player3').setDescription('Player 3 — required for RPS 3-player / Number Guess').setRequired(false))
        .addIntegerOption(o => o.setName('bet').setDescription('Souls bet per player — Number Guess only').setMinValue(1).setRequired(false)),

    async execute(interaction, config, client) {
        const game = interaction.options.getString('game');
        const users = [
            interaction.user,
            interaction.options.getUser('player1'),
            interaction.options.getUser('player2'),
            interaction.options.getUser('player3'),
        ].filter(Boolean);
        const players = [...new Map(users.map(u => [u.id, u])).values()];

        if (players.some(p => p.bot)) {
            return interaction.reply({ content: '❌ Bots cannot join PvP matches.', ephemeral: true });
        }

        const required = game === 'number' ? 4 : game === 'rps' ? (players.length === 3 ? 3 : 2) : 2;
        if (players.length !== required) {
            return interaction.reply({
                content: `❌ **${game === 'number' ? 'Number Guess' : game === 'rps' ? 'Rock Paper Scissors' : 'Heads & Tails'}** requires exactly **${required} players**.`,
                ephemeral: true,
            });
        }

        const entry = game === 'number' ? Number(interaction.options.getInteger('bet') || 0) : game === 'rps' ? ENTRY_RPS : ENTRY_COIN;
        if (game === 'number' && entry < 1) {
            return interaction.reply({ content: `❌ Set a Souls bet for each player using the **bet** option.`, ephemeral: true });
        }

        const gameName = game === 'rps' ? 'Rock Paper Scissors' : game === 'coin' ? 'Heads & Tails' : 'Number Guess';
        await interaction.deferReply();
        await interaction.editReply(`📨 Invitations sent to ${players.slice(1).map(p => `<@${p.id}>`).join(', ')}.\nWaiting for everyone to accept...`);

        const accepted = await invitePlayers(interaction, players.slice(1), gameName);
        const rejected = players.slice(1).find(p => !accepted.get(p.id));
        if (rejected) return interaction.editReply(`❌ <@${rejected.id}> rejected the match or did not respond. **Match cancelled.**`);

        const guildId = interaction.guildId;
        const charged = [];
        for (const player of players) {
            const data = await getWallet(client, guildId, player.id);
            if (Number(data.wallet || 0) < entry) {
                return interaction.editReply(`❌ <@${player.id}> does not have enough ${SOULS} for the **${fmt(entry)} Souls** ${game === 'number' ? 'bet' : 'entry fee'}. Match cancelled.`);
            }
            charged.push([player, data]);
        }
        for (const [player, data] of charged) {
            data.wallet = Number(data.wallet || 0) - entry;
            await saveWallet(client, guildId, player.id, data);
        }
        const pot = entry * players.length;

        if (game === 'rps') {
            const choices = await collectChoice(players, interaction.guild.name, 'Rock Paper Scissors', [
                { label: '🪨 Rock', value: 'rock' },
                { label: '📄 Paper', value: 'paper' },
                { label: '✂️ Scissors', value: 'scissors' },
            ], 'pvp_rps');
            if (choices.size !== players.length) {
                for (const [player] of charged) {
                    const data = await getWallet(client, guildId, player.id);
                    data.wallet += entry;
                    await saveWallet(client, guildId, player.id, data);
                }
                return interaction.editReply('⏰ Someone did not choose in time. **Entry fees refunded and match cancelled.**');
            }
            const winners = rpsWinners(players, choices);
            if (!winners.length) {
                for (const [player] of charged) {
                    const data = await getWallet(client, guildId, player.id);
                    data.wallet += entry;
                    await saveWallet(client, guildId, player.id, data);
                }
                return interaction.editReply('🤝 **RPS DRAW!** Everyone tied. Entry fees refunded.');
            }
            const share = Math.floor(pot / winners.length);
            for (const winner of winners) {
                const data = await getWallet(client, guildId, winner.id);
                data.wallet += share;
                await saveWallet(client, guildId, winner.id, data);
            }
            return interaction.editReply(`🏆 **RPS MATCH COMPLETE!**\n\nWinner${winners.length > 1 ? 's' : ''}: ${winners.map(p => `<@${p.id}>`).join(', ')}\n${SOULS} **${fmt(share)} Souls** paid to each winner.\n${TOTAL} Pot: **${fmt(pot)} Souls**.`);
        }

        if (game === 'coin') {
            const choices = await collectChoice(players, interaction.guild.name, 'Heads & Tails', [
                { label: 'Heads — Souls', value: 'heads' },
                { label: 'Tails', value: 'tails' },
            ], 'pvp_coin');
            if (choices.size !== 2) {
                for (const [player] of charged) {
                    const data = await getWallet(client, guildId, player.id);
                    data.wallet += entry;
                    await saveWallet(client, guildId, player.id, data);
                }
                return interaction.editReply('⏰ A player did not choose in time. **Entry fees refunded.**');
            }
            const flip = Math.random() < 0.5 ? 'heads' : 'tails';
            const winners = players.filter(p => choices.get(p.id) === flip);
            const share = Math.floor(pot / winners.length);
            for (const winner of winners) {
                const data = await getWallet(client, guildId, winner.id);
                data.wallet += share;
                await saveWallet(client, guildId, winner.id, data);
            }
            return interaction.editReply(`${flip === 'heads' ? SOULS : TAILS} **${flip.toUpperCase()}!**\n\nWinner: ${winners.map(p => `<@${p.id}>`).join(', ')}\n${SOULS} **${fmt(share)} Souls** paid to each winner.`);
        }

        const guesses = await collectChoice(players, interaction.guild.name, `Number Guess — 1 to 4 — Bet ${fmt(entry)} Souls`, [
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '4', value: '4' },
        ], 'pvp_num');
        if (guesses.size !== 4) {
            for (const [player] of charged) {
                const data = await getWallet(client, guildId, player.id);
                data.wallet += entry;
                await saveWallet(client, guildId, player.id, data);
            }
            return interaction.editReply('⏰ Someone did not guess in time. **All bets refunded.**');
        }
        const secret = String(Math.floor(Math.random() * 4) + 1);
        const winners = players.filter(p => guesses.get(p.id) === secret);
        if (!winners.length) {
            for (const [player] of charged) {
                const data = await getWallet(client, guildId, player.id);
                data.wallet += entry;
                await saveWallet(client, guildId, player.id, data);
            }
            return interaction.editReply(`🎯 The number was **${secret}**. Nobody guessed it. **All bets refunded.**`);
        }
        const share = Math.floor(pot / winners.length);
        for (const winner of winners) {
            const data = await getWallet(client, guildId, winner.id);
            data.wallet += share;
            await saveWallet(client, guildId, winner.id, data);
        }
        return interaction.editReply(`🎯 **NUMBER GUESS COMPLETE!**\nThe number was **${secret}**.\nWinner${winners.length > 1 ? 's' : ''}: ${winners.map(p => `<@${p.id}>`).join(', ')}\n${SOULS} **${fmt(share)} Souls** paid to each winner from the **${fmt(pot)} Souls** pot.`);
    },
};
