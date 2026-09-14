import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';

const SOULS = '<:Souls:1547510037621112894>';
const TOTAL = '<:Total:1547545479628333086>';
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const SUCCESS_RATE = 0.40;
const MAX_STEAL_RATE = 0.80;

function fmt(n) { return Number(n || 0).toLocaleString(); }
function token() { return Math.random().toString(36).slice(2, 10); }

async function invitePlayers(interaction, players) {
    const id = token();
    const status = new Map([[interaction.user.id, true]]);

    await Promise.all(players.slice(1).map(async player => {
        try {
            const dm = await player.createDM();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`rob_accept_${id}`).setLabel('Join Robbery').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`rob_reject_${id}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
            );
            const message = await dm.send({
                content: `🚨 **${interaction.user.username}** invited you to a **Bank Robbery** in **${interaction.guild.name}**.\n\nYou have **60 seconds** to respond.`,
                components: [row],
            });
            const response = await message.awaitMessageComponent({
                time: 60_000,
                filter: i => i.user.id === player.id && [
                    `rob_accept_${id}`,
                    `rob_reject_${id}`,
                ].includes(i.customId),
            }).catch(() => null);
            if (!response) {
                status.set(player.id, false);
                return;
            }
            const accepted = response.customId === `rob_accept_${id}`;
            status.set(player.id, accepted);
            await response.update({
                content: accepted ? '✅ You joined the robbery crew.' : '❌ You rejected the robbery invitation.',
                components: [],
            }).catch(() => {});
        } catch {
            status.set(player.id, false);
        }
    }));

    return status;
}

export default {
    data: new SlashCommandBuilder()
        .setName('bankrob')
        .setDescription('Plan a 2-10 player bank robbery.')
        .addUserOption(o => o.setName('target').setDescription('The member whose wallet you are trying to rob').setRequired(true))
        .addUserOption(o => o.setName('player1').setDescription('Crew member 1').setRequired(true))
        .addUserOption(o => o.setName('player2').setDescription('Crew member 2').setRequired(false))
        .addUserOption(o => o.setName('player3').setDescription('Crew member 3').setRequired(false))
        .addUserOption(o => o.setName('player4').setDescription('Crew member 4').setRequired(false))
        .addUserOption(o => o.setName('player5').setDescription('Crew member 5').setRequired(false))
        .addUserOption(o => o.setName('player6').setDescription('Crew member 6').setRequired(false))
        .addUserOption(o => o.setName('player7').setDescription('Crew member 7').setRequired(false))
        .addUserOption(o => o.setName('player8').setDescription('Crew member 8').setRequired(false))
        .addUserOption(o => o.setName('player9').setDescription('Crew member 9').setRequired(false)),

    async execute(interaction, config, client) {
        const target = interaction.options.getUser('target');
        const selected = [interaction.user];
        for (let i = 1; i <= 9; i++) {
            const user = interaction.options.getUser(`player${i}`);
            if (user) selected.push(user);
        }
        const players = [...new Map(selected.map(u => [u.id, u])).values()];

        if (target.id === interaction.user.id || target.bot) {
            return interaction.reply({ content: '❌ You cannot rob yourself or a bot.', ephemeral: true });
        }
        if (players.some(p => p.id === target.id)) {
            return interaction.reply({ content: '❌ The robbery target cannot be part of the crew.', ephemeral: true });
        }
        if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
            return interaction.reply({ content: '❌ A robbery crew must have **2-10 players**.', ephemeral: true });
        }

        await interaction.deferReply();
        await interaction.editReply(`📨 Robbery invitations sent to ${players.slice(1).map(p => `<@${p.id}>`).join(', ')}.\nWaiting for the crew to accept...`);
        const status = await invitePlayers(interaction, players);
        const rejected = players.slice(1).find(p => !status.get(p.id));
        if (rejected) return interaction.editReply(`❌ <@${rejected.id}> rejected the robbery or did not respond. **Robbery cancelled.**`);

        const targetData = await getEconomyData(client, interaction.guildId, target.id);
        const targetWallet = Number(targetData.wallet || 0);
        if (targetWallet <= 0) return interaction.editReply(`❌ <@${target.id}> has no Souls in their wallet to rob.`);

        const success = Math.random() < SUCCESS_RATE;
        if (!success) {
            return interaction.editReply(`🚔 **ROBBERY FAILED!**\n\nThe police caught the crew. **60% failure chance.**\nNo Souls were stolen.`);
        }

        const maxLoot = Math.floor(targetWallet * MAX_STEAL_RATE);
        const loot = Math.max(1, Math.floor(Math.random() * maxLoot) + 1);
        const share = Math.floor(loot / players.length);
        const remainder = loot - share * players.length;

        targetData.wallet = Math.max(0, targetWallet - loot);
        await setEconomyData(client, interaction.guildId, target.id, targetData);

        for (const player of players) {
            const data = await getEconomyData(client, interaction.guildId, player.id);
            data.wallet = Number(data.wallet || 0) + share;
            await setEconomyData(client, interaction.guildId, player.id, data);
        }
        if (remainder > 0) {
            const leaderData = await getEconomyData(client, interaction.guildId, interaction.user.id);
            leaderData.wallet = Number(leaderData.wallet || 0) + remainder;
            await setEconomyData(client, interaction.guildId, interaction.user.id, leaderData);
        }

        return interaction.editReply(
            `🏦 **ROBBERY SUCCESSFUL!**\n\n` +
            `The crew successfully robbed <@${target.id}>.\n` +
            `${SOULS} **${fmt(loot)} Souls** stolen.\n` +
            `Each of the **${players.length} crew members** receives **${fmt(share)} Souls**.\n` +
            `💰 Target had **${fmt(targetWallet)} Souls** → up to **80%** could be stolen.\n` +
            `${TOTAL} Success chance: **40%** • Police catch chance: **60%**.`
        );
    },
};
