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
        title: 'The Sweet Ruin',
        story: 'Carmine was once touched by the light of Heaven, but eternity felt empty to her. She became fascinated by forbidden desires and slowly abandoned the purity expected of her. What began as curiosity became obsession, and her heavenly grace twisted into a beautiful ruin. She learned that the sweetest desires can become the most destructive sins.',
        arrival: 'Carmine followed the whisper of forbidden desire until it led her to the gates of the Hollow Devil’s Domain. The Hollow Devil did not ask her to return to Heaven or hide what she had become. Instead, the Domain gave her a place where desire could exist without chains. Carmine entered willingly and made the darkness her new sanctuary.'
    },
    Valeris: {
        title: 'The Tempting Void',
        story: 'Valeris was drawn to the Void not because she feared it, but because she wanted to understand what existed beyond it. Every step into the darkness revealed another desire, another secret, and another reason to continue. Eventually, the Void stopped feeling empty and began calling to her like a promise she could never ignore.',
        arrival: 'The Hollow Devil found Valeris standing at the edge of the Void, already knowing there was no reason to turn back. The gates of the Domain opened before her, and she stepped through without hesitation. From that moment on, Valeris belonged to the darkness beyond the Void—and anyone who follows her may find it impossible to return.'
    },
    Niko: {
        title: 'The Fallen Beauty',
        story: 'Niko was once seen as something almost angelic—beautiful, distant, and untouched by darkness. But even the purest light can fall. Niko eventually discovered that the abyss did not destroy beauty; it transformed it. Instead of fearing the darkness, Niko embraced it and found a strange sense of belonging within it.',
        arrival: 'Niko entered the Hollow Devil’s Domain after choosing the abyss over the world that expected perfection. The Domain became a place where falling was not a weakness and darkness did not erase beauty. Niko remained there by choice, believing that some souls are meant to shine from the shadows.'
    },
    Eiris: {
        title: 'The Eternal Requiem',
        story: 'Eiris became obsessed with the idea that beauty should never truly disappear. She watched people, memories, and entire eras fade away, and she refused to accept that everything beautiful must eventually be forgotten. Her search led her toward forbidden powers that could preserve an echo long after the original was gone.',
        arrival: 'The Hollow Devil’s Domain reached Eiris through a voice that promised her one thing: she would be remembered. She crossed into the Domain and discovered a place where the dead, the forgotten, and the eternal could leave their mark. Eiris stayed, becoming a quiet presence whose voice lingers long after others have gone.'
    },
    Seraphne: {
        title: 'The Toxic Grace',
        story: 'Seraphne was born with an unnatural connection to serpents. Snakes gathered around her from childhood, responding to her as if she were one of their own. Hidden within her bloodline was an ancient serpent spirit whose power slowly awakened inside her. Its venom changed her magic, her nature, and eventually the way others saw her. She became beautiful, graceful, and dangerously poisonous.',
        arrival: 'When people began to fear the serpent power within Seraphne, she was driven away from the world she once knew. The ancient serpent spirit guided her toward the Hollow Devil’s Domain, where darkness welcomed what the outside world rejected. Seraphne entered the Domain and accepted the serpent within her, becoming its living embodiment of toxic grace.'
    },
    Lumira: {
        title: 'The Guiding Sin',
        story: 'Lumira carried a radiant light that could guide others through even the darkest places. But her light came with a strange curse: whenever someone she cared about was lost, she could feel their presence calling from the shadows. Instead of abandoning them, Lumira began walking into the darkness herself, determined to find those who could no longer find their way back.',
        arrival: 'Her search eventually brought Lumira to the Hollow Devil’s Domain. She entered its darkness believing that even the deepest abyss could contain someone worth saving. The Hollow Devil allowed her to remain, and Lumira became a guide between light and shadow—following lost souls wherever they disappear.'
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