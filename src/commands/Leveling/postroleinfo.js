import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const ROLE_INFO_CHANNEL_ID = '1530876980873007180';

const ROLE_INFO = [
    {
        emoji: '🔵',
        role: 'Lost Soul',
        level: 5,
        reward: '500 Souls',
        description: 'First milestone. Shows you\'re an active member.',
    },
    {
        emoji: '⚪',
        role: 'Shadow Walker',
        level: 10,
        reward: '1,000 Souls',
        description: 'You\'re becoming a regular.',
    },
    {
        emoji: '😈',
        role: "Devil's Pawn",
        level: 20,
        reward: '2,000 Souls',
        description: 'Trusted community member.',
    },
    {
        emoji: '⚔️',
        role: 'Abyss Hunter',
        level: 30,
        reward: '3,000 Souls',
        description: 'Veteran explorer.',
    },
    {
        emoji: '🔥',
        role: 'Hell Maker',
        level: 40,
        reward: '4,000 Souls',
        description: 'Access to Hellborn Lounge.',
    },
    {
        emoji: '💀',
        role: 'Void Reaper',
        level: 50,
        reward: '5,000 Souls',
        description: 'Self Promotion unlocked.',
    },
    {
        emoji: '👑',
        role: 'Hollow Lord',
        level: 75,
        reward: '7,500 Souls',
        description: 'Elite member.',
    },
    {
        emoji: '👑',
        role: 'Hollow Legend',
        level: 100,
        reward: '10,000 Souls',
        description: 'One of the most dedicated members.',
    },
];

function buildRoleInfoMessage() {
    const lines = [
        '✦━━━━━━━━━━━━━━━━━━━━✦',
        '',
        '**『 🏆 MILESTONE ROLES 』**',
        '**Level up. Earn your place in the Domain.**',
        '',
    ];

    for (const item of ROLE_INFO) {
        lines.push(`**『 ${item.emoji} ${item.role} 』  [Lv.${item.level}]**`);
        lines.push(`➜ ${item.description}`);
        lines.push(`➜ **Reward:** ${item.reward} <:Souls:1547510037621112894>`);
        lines.push('');
        lines.push('✦━━━━━━━━━━━━━━━━━━━━✦');
        lines.push('');
    }

    lines.push('☾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━☽');
    lines.push('');
    lines.push('*"Only the most loyal souls ascend through the Domain.*');
    lines.push('*Every message, every conversation, every moment brings you one step closer to becoming a legend."*');
    lines.push('');
    lines.push('☽━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━☾');

    return lines.join('\n');
}

export default {
    data: new SlashCommandBuilder()
        .setName('postroleinfo')
        .setDescription('Post the milestone role and Souls reward information')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    category: 'Leveling',

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need the **Manage Server** permission to use this command.',
                ephemeral: true,
            });
        }

        const channel = await interaction.guild.channels.fetch(ROLE_INFO_CHANNEL_ID).catch(() => null);

        if (!channel?.isTextBased()) {
            return interaction.reply({
                content: '❌ The configured Role Info channel could not be found.',
                ephemeral: true,
            });
        }

        const message = buildRoleInfoMessage();

        await channel.send({ content: message });

        return interaction.reply({
            content: `✅ Milestone role information posted in <#${ROLE_INFO_CHANNEL_ID}>.`,
            ephemeral: true,
        });
    },
};
