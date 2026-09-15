import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';

const SOULS = '<:Souls:1547510037621112894>';
const TOTAL = '<:Total:1547545479628333086>';
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const SUCCESS_RATE = 0.40;
const MAX_STEAL_RATE = 0.80;

function fmt(n) {
    return Number(n || 0).toLocaleString();
}

function token() {
    return Math.random().toString(36).slice(2, 10);
}

async function channelInvite(interaction, players) {
    const id = token();
    const accepted = new Set([interaction.user.id]);
    let rejectedUser = null;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rob_join_${id}`)
            .setLabel('Join Robbery')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`rob_reject_${id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
    );

    const message = await interaction.editReply({
        content: `🚨 **${interaction.user.username}** is forming a **Bank Robbery** crew.\n\n${players.slice(1).map(p => `• <@${p.id}> — ⏳ Waiting`).join('\n')}\n\n**Join directly in this channel. You have 60 seconds.**`,
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
                await component.reply({ content: 'You are already in this robbery.', ephemeral: true }).catch(() => {});
                return;
            }

            if (component.customId === `rob_reject_${id}`) {
                rejectedUser = player;
                await component.reply({ content: '❌ You rejected the robbery.', ephemeral: true }).catch(() => {});
                collector.stop('rejected');
                return;
            }

            if (accepted.has(player.id)) {
                await component.reply({ content: '✅ You already joined.', ephemeral: true }).catch(() => {});
                return;
            }

            accepted.add(player.id);
            await component.reply({ content: '✅ You joined the robbery crew.', ephemeral: true }).catch(() => {});

            if (accepted.size === players.length) {
                collector.stop('accepted');
            } else {
                await interaction.editReply({
                    content: `🚨 **BANK ROBBERY CREW**\n\n${players.slice(1).map(p => `• <@${p.id}> — ${accepted.has(p.id) ? '✅ Joined' : '⏳ Waiting'}`).join('\n')}\n\nWaiting for the remaining crew members...`,
                    components: [row]
                }).catch(() => {});
            }
        });

        collector.on('end', async (_collected, reason) => {
            await interaction.editReply({ components: [] }).catch(() => {});

            if (rejectedUser) {
                resolve({ ok: false, reason: 'rejected', user: rejectedUser });
                return;
            }

            if (reason === 'accepted' || accepted.size === players.length) {
                resolve({ ok: true });
                return;
            }

            resolve({ ok: false, reason: 'timeout' });
        });
    });
}

export default {
    data: new SlashCommandBuilder()
        .setName('bankrob')
        .setDescription('Plan a 2-10 player bank robbery.')
        .addUserOption(option => option.setName('target').setDescription('The member whose wallet you are trying to rob').setRequired(true))
        .addUserOption(option => option.setName('player1').setDescription('Crew member 1').setRequired(true))
        .addUserOption(option => option.setName('player2').setDescription('Crew member 2').setRequired(false))
        .addUserOption(option => option.setName('player3').setDescription('Crew member 3').setRequired(false))
        .addUserOption(option => option.setName('player4').setDescription('Crew member 4').setRequired(false))
        .addUserOption(option => option.setName('player5').setDescription('Crew member 5').setRequired(false))
        .addUserOption(option => option.setName('player6').setDescription('Crew member 6').setRequired(false))
        .addUserOption(option => option.setName('player7').setDescription('Crew member 7').setRequired(false))
        .addUserOption(option => option.setName('player8').setDescription('Crew member 8').setRequired(false))
        .addUserOption(option => option.setName('player9').setDescription('Crew member 9').setRequired(false)),

    async execute(interaction, config, client) {
        const target = interaction.options.getUser('target', true);
        const selected = [interaction.user];

        for (let i = 1; i <= 9; i += 1) {
            const user = interaction.options.getUser(`player${i}`);
            if (user) selected.push(user);
        }

        const players = [...new Map(selected.map(user => [user.id, user])).values()];

        if (target.id === interaction.user.id || target.bot) {
            return interaction.reply({ content: '❌ You cannot rob yourself or a bot.', ephemeral: true });
        }

        if (players.some(player => player.id === target.id)) {
            return interaction.reply({ content: '❌ The robbery target cannot be part of the crew.', ephemeral: true });
        }

        if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
            return interaction.reply({ content: '❌ A robbery crew must have **2–10 players**.', ephemeral: true });
        }

        await interaction.deferReply();

        const invite = await channelInvite(interaction, players);
        if (!invite.ok) {
            if (invite.reason === 'rejected') {
                return interaction.editReply(`❌ <@${invite.user.id}> rejected the robbery. **Robbery cancelled.**`);
            }
            return interaction.editReply('⏰ Not everyone joined within 60 seconds. **Robbery cancelled.**');
        }

        const guildId = interaction.guildId;
        const targetData = await getEconomyData(client, guildId, target.id);
        const targetWallet = Number(targetData.wallet || 0);

        if (targetWallet <= 0) {
            return interaction.editReply(`❌ <@${target.id}> has no Souls in their wallet to rob.`);
        }

        const protectionExpiry = Number(targetData.bankProtectionExpiresAt || 0);
        if (protectionExpiry > Date.now()) {
            const remainingHours = Math.max(1, Math.ceil((protectionExpiry - Date.now()) / (60 * 60 * 1000)));
            return interaction.editReply(`🛡️ **BANK PROTECTED!**\n\n<@${target.id}> has active Bank Protection for approximately **${remainingHours} more hour${remainingHours === 1 ? '' : 's'}**.\nNo Souls were stolen.`);
        }

        const success = Math.random() < SUCCESS_RATE;
        if (!success) {
            return interaction.editReply(`🚔 **ROBBERY FAILED!**\n\nThe police caught the crew. **40% success / 60% police catch.**\nNo Souls were stolen.`);
        }

        const maxLoot = Math.floor(targetWallet * MAX_STEAL_RATE);
        if (maxLoot <= 0) {
            return interaction.editReply(`❌ <@${target.id}> does not have enough Souls for a successful robbery.`);
        }

        const loot = Math.max(1, Math.floor(Math.random() * maxLoot) + 1);
        const share = Math.floor(loot / players.length);
        const remainder = loot - (share * players.length);

        targetData.wallet = Math.max(0, targetWallet - loot);
        await setEconomyData(client, guildId, target.id, targetData);

        for (const player of players) {
            const data = await getEconomyData(client, guildId, player.id);
            data.wallet = Number(data.wallet || 0) + share;
            await setEconomyData(client, guildId, player.id, data);
        }

        if (remainder > 0) {
            const leaderData = await getEconomyData(client, guildId, interaction.user.id);
            leaderData.wallet = Number(leaderData.wallet || 0) + remainder;
            await setEconomyData(client, guildId, interaction.user.id, leaderData);
        }

        return interaction.editReply(
            `🏦 **ROBBERY SUCCESSFUL!**\n\n` +
            `The crew successfully robbed <@${target.id}>.\n` +
            `${SOULS} **${fmt(loot)} Souls** stolen.\n` +
            `Each of the **${players.length} crew members** receives **${fmt(share)} Souls**.\n` +
            `💰 Target had **${fmt(targetWallet)} Souls** → up to **80%** could be stolen.\n` +
            `${TOTAL} Success chance: **40%** • Police catch chance: **60%**.`
        );
    }
};
