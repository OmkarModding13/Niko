import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { CHARACTER_CATALOG } from '../../services/gacha/characters.js';
import { getColor } from '../../config/bot.js';

const CHARACTER_INFO_CHANNEL_ID = '1550118678396149910';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/OmkarModding13/Niko/main/assets/info';

const CHARACTER_ORDER = [
    'Carmine',
    'Valeris',
    'Niko',
    'Eiris',
    'Seraphne',
    'Lumira'
];

const INFO_IMAGES = {
    Carmine: 'InfoCarmine.png',
    Valeris: 'InfoValeris.png',
    Niko: 'infoNiko.png',
    Eiris: 'InfoEiris.png',
    Seraphne: 'InfoSeraphne.png',
    Lumira: 'InfoLumira.png'
};

const RARITY_EMOJIS = {
    4: '⭐⭐⭐⭐',
    5: '⭐⭐⭐⭐⭐'
};

function createCharacterEmbed(character) {
    const imageFile = INFO_IMAGES[character.name];
    const imageUrl = `${GITHUB_RAW_BASE}/${encodeURIComponent(imageFile)}`;

    return new EmbedBuilder()
        .setTitle(`${RARITY_EMOJIS[character.stars] || ''} ${character.name}`)
        .setColor(character.stars === 5 ? getColor('economy') : getColor('primary'))
        .addFields(
            {
                name: '👤 Character Info',
                value:
                    `**Name:** ${character.name}\n` +
                    `**Rarity:** ${character.stars}★\n` +
                    `**Class:** ${character.rarity}`,
                inline: false
            },
            {
                name: '⚡ Ability',
                value: character.ability,
                inline: false
            }
        )
        .setImage(imageUrl)
        .setFooter({ text: 'Hollow Devil • Character Ability Archive' });
}

export default {
    data: new SlashCommandBuilder()
        .setName('character-info')
        .setDescription('Post all character information and abilities to the character info channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: '❌ This command can only be used inside a server.',
                ephemeral: true
            });
            return;
        }

        const channel = await interaction.guild.channels.fetch(CHARACTER_INFO_CHANNEL_ID).catch(() => null);

        if (!channel?.isTextBased()) {
            await interaction.reply({
                content: `❌ Character info channel <#${CHARACTER_INFO_CHANNEL_ID}> could not be found or is not a text channel.`,
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        let posted = 0;

        for (const characterName of CHARACTER_ORDER) {
            const character = CHARACTER_CATALOG[characterName];

            if (!character) continue;

            await channel.send({
                embeds: [createCharacterEmbed(character)]
            });

            posted += 1;
        }

        await interaction.editReply({
            content: `✅ Posted **${posted} character info posts** in <#${CHARACTER_INFO_CHANNEL_ID}>.`
        });
    }
};