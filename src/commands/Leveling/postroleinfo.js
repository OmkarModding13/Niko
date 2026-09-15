import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const ROLE_INFO_CHANNEL_ID = '1530876980873007180';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';

const ROLE_INFO = [
    { emoji: '🔵', role: 'Lost Soul', level: 5, souls: 500, shards: 5, description: 'First milestone. Shows you\'re an active member.' },
    { emoji: '⚪', role: 'Shadow Walker', level: 10, souls: 1000, shards: 10, description: 'You\'re becoming a regular.' },
    { emoji: '😈', role: "Devil's Pawn", level: 20, souls: 2000, shards: 20, description: 'Trusted community member.' },
    { emoji: '⚔️', role: 'Abyss Hunter', level: 30, souls: 3000, shards: 30, description: 'Veteran explorer.' },
    { emoji: '🔥', role: 'Hell Maker', level: 40, souls: 4000, shards: 40, description: 'Access to Hellborn Lounge.' },
    { emoji: '💀', role: 'Void Reaper', level: 50, souls: 5000, shards: 50, description: 'Self Promotion unlocked.' },
    { emoji: '👑', role: 'Hollow Lord', level: 75, souls: 7500, shards: 75, description: 'Elite member.' },
    { emoji: '👑', role: 'Hollow Legend', level: 100, souls: 10000, shards: 100, description: 'One of the most dedicated members.' }
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
        lines.push(`**『 ${item.emoji} ${item.role} 』 [Lv.${item.level}]**`);
        lines.push(`➜ ${item.description}`);
        lines.push(`➜ **Reward:** ${SOULS_EMOJI} **${item.souls.toLocaleString()} Souls** + ${SHARD_EMOJI} **${item.shards} Shards**`);
        lines.push('');
        lines.push('✦━━━━━━━━━━━━━━━━━━━━✦');
        lines.push('');
    }

    lines.push('☾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━☽');
    lines.push('');
    lines.push('*Every milestone now rewards both Souls and Shards.*');
    lines.push('*Use your Shards in **/gacha** to summon characters and rare rewards.*');
    lines.push('');
    lines.push('☽━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━☾');

    return lines.join('\n');
}

export default {
    data: new SlashCommandBuilder()
        .setName('postroleinfo')
        .setDescription('Post the milestone role, Souls and Shard reward information')
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

        await channel.send({ content: buildRoleInfoMessage() });

        return interaction.reply({
            content: `✅ Milestone role information posted in <#${ROLE_INFO_CHANNEL_ID}>.`,
            ephemeral: true,
        });
    },
};
