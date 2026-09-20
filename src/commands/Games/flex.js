import {
    SlashCommandBuilder,
    AttachmentBuilder,
    EmbedBuilder
} from 'discord.js';

import { getEconomyData } from '../../utils/economy.js';
import { createFlexImage } from '../../services/gacha/flexImage.js';
import { getOwnedCharacters, CHARACTER_CATALOG } from '../../services/gacha/characters.js';

export default {
    data: new SlashCommandBuilder()
        .setName('flex')
        .setDescription('Show your character collection.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Show another member\'s collection.')
                .setRequired(false)
        ),

    category: 'Games',

    async execute(interaction, config, client) {

        const target = interaction.options.getUser('user') || interaction.user;
        const userData = await getEconomyData(client, interaction.guildId, target.id);
        const owned = getOwnedCharacters(userData);
        const count = Object.keys(owned).filter(name => CHARACTER_CATALOG[name]).length;

        const image = await createFlexImage(userData, target.displayName || target.username);
        const attachment = new AttachmentBuilder(image, { name: 'character-flex.png' });

        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle(`✨ ${target.displayName || target.username}'s Character Collection`)
            .setDescription(`**${count}/${Object.keys(CHARACTER_CATALOG).length} characters owned**`)
            .setImage('attachment://character-flex.png');

        return interaction.reply({
            embeds: [embed],
            files: [attachment]
        });
    }
};