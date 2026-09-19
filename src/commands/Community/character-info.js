import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { CHARACTER_CATALOG } from '../../services/gacha/characters.js';
import { getColor } from '../../config/bot.js';

const CHARACTER_INFO_CHANNEL_ID = '1550118678396149910';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/OmkarModding13/Niko/main/src/assets/Info';

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


const CHARACTER_LORE = {
    Carmine: {
        title: 'The Crimson Temptation',
        story: 'Carmine was once a noble soul who lost everything to betrayal. Her grief hardened into a crimson hunger, and she wandered until the Hollow Devil found her at the edge of the abyss.',
        arrival: 'The Hollow Devil offered her a place where broken souls were not judged. Carmine entered the Domain willingly, choosing to turn her past into power rather than let it consume her.'
    },
    Valeris: {
        title: 'The Fallen Crown',
        story: 'Valeris was once a feared ruler who built her kingdom through strength and absolute resolve. When her empire fell, she remained alone among its ruins, refusing to surrender her will.',
        arrival: 'The Hollow Devil witnessed her final stand and opened the gates of the Domain. Valeris accepted the invitation, seeing the Domain as a new kingdom where her ambition could survive.'
    },
    Niko: {
        title: 'The Silent Wanderer',
        story: 'Niko appeared without a past, carrying only fragments of memories and an instinctive connection to the strange energy surrounding the abyss. No one knows exactly where Niko came from.',
        arrival: 'A strange pull led Niko to the gates of the Hollow Devil’s Domain. Instead of turning away, Niko stepped inside and became one of its mysterious inhabitants.'
    },
    Eiris: {
        title: 'The Eternal Reign',
        story: 'Eiris spent centuries searching for a way to escape the limits of ordinary existence. Her search eventually brought her face-to-face with forces beyond the mortal world.',
        arrival: 'The Hollow Devil offered Eiris a path beyond the cycle she had been trying to escape. She entered the Domain to uncover the truth behind its endless darkness.'
    },
    Seraphne: {
        title: 'The Serpent Witch',
        story: 'Seraphne was born with a strange bond to serpents. As a child, snakes gathered around her without fear, and she could sense their thoughts as if they were whispers inside her own mind. She eventually learned that the bond came from an ancient serpent spirit sealed within her bloodline. The more she embraced its power, the more serpentine traits began to appear, changing her into something neither fully human nor fully beast.',
        arrival: 'When hunters came for her after witnessing her serpent powers, Seraphne fled into the wilderness. The ancient serpent spirit led her toward a place where darkness felt strangely familiar—the Hollow Devil’s Domain. The Hollow Devil recognized the power inside her and offered her sanctuary. Seraphne entered the Domain, where she finally stopped hiding what she had become and accepted the serpent as part of herself.'
    },
    Lumira: {
        title: 'The Golden Light',
        story: 'Lumira carried a light that never seemed to fade, even when surrounded by darkness. She spent her life searching for a place where that light could coexist with the shadows within her.',
        arrival: 'Lumira discovered the Hollow Devil’s Domain and found that its darkness did not extinguish her light. She entered to discover why the two forces seemed strangely connected.'
    }
};

const RARITY_EMOJIS = {
    4: '⭐⭐⭐⭐',
    5: '⭐⭐⭐⭐⭐'
};

function createCharacterPost(character) {
    const imageFile = INFO_IMAGES[character.name];
    const imageUrl = `${GITHUB_RAW_BASE}/${encodeURIComponent(imageFile)}`;
    const lore = CHARACTER_LORE[character.name];

    const bannerEmbed = new EmbedBuilder()
        .setColor(character.stars === 5 ? getColor('economy') : getColor('primary'))
        .setImage(imageUrl);

    const infoEmbed = new EmbedBuilder()
        
        .setColor(character.stars === 5 ? getColor('economy') : getColor('primary'))
        .addFields(
            {
                name: '👤 Character Info',
                value:
                    `**Name:** ${character.name}\n` +
                    `**Rarity:** ${RARITY_EMOJIS[character.stars] || `${character.stars}★`}\n` +
                    `**Class:** ${character.rarity}\n` +
                    `**Title:** ${lore?.title || 'Unknown'}`,
                inline: false
            },
            {
                name: '📖 Short Story',
                value: lore?.story || 'This character’s story has yet to be revealed.',
                inline: false
            },
            {
                name: '🌑 How They Entered Hollow Devil’s Domain',
                value: lore?.arrival || 'Their arrival remains a mystery.',
                inline: false
            },
            {
                name: '⚡ Ability',
                value: character.ability,
                inline: false
            }
        )
        .setFooter({ text: 'Hollow Devil • Character Ability Archive' });

    return [bannerEmbed, infoEmbed];
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
                embeds: createCharacterPost(character)
            });

            posted += 1;
        }

        await interaction.editReply({
            content: `✅ Posted **${posted} character info posts** in <#${CHARACTER_INFO_CHANNEL_ID}>.`
        });
    }
};