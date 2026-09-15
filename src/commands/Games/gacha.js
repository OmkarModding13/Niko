import {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import {
    GACHA_REWARD_WEIGHTS,
    FOUR_STAR_CHARACTERS,
    FIVE_STAR_CHARACTERS,
    addCharacter,
    getCharacterBonuses
} from '../../services/gacha/characters.js';
import { addLevelXp, setXpMultiplier } from '../../services/leveling/leveling.js';

const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
const SHARD_BUTTON_EMOJI = { id: '1548962748321374218', name: 'Shard' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHARACTER_IMAGE_DIR = path.join(__dirname, '../../assets/gacha/Characters');
const GACHA_BANNER = path.join(__dirname, '../../assets/gacha/Spin and Win.png');
const SPIN_COSTS = { 1: 1, 10: 10 };

// Prevent two gacha requests for the same user from reading/writing
// the same economy snapshot at the same time.
const activeGachaSpins = new Set();

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedRarity(userData) {
    const bonuses = getCharacterBonuses(userData);
    const luck = Math.max(0, Number(bonuses.gachaLuckBonus || 0));
    const weights = GACHA_REWARD_WEIGHTS.map(item => ({ ...item }));

    for (const item of weights) {
        if (item.rarity === 'Legendary' || item.rarity === 'Mystic') item.weight += luck;
    }

    const total = weights.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;

    for (const item of weights) {
        roll -= item.weight;
        if (roll < 0) return item.rarity;
    }

    return 'Common';
}

function pickCharacter(list) {
    return list[Math.floor(Math.random() * list.length)] || null;
}

function createCharacterAttachment(character) {
    return new AttachmentBuilder(
        path.join(CHARACTER_IMAGE_DIR, character.image),
        { name: character.image }
    );
}

function convertDuplicate(userData, character) {
    userData.shards = Number(userData.shards || 0) + 2;
    return {
        rarity: character.rarity,
        type: 'duplicate_conversion',
        shards: 2,
        character,
        stars: character.stars
    };
}

function grantReward(userData) {
    const rarity = pickWeightedRarity(userData);

    if (rarity === 'Common') {
        const double = Math.random() < 0.25;
        const souls = double ? randomBetween(200, 500) : randomBetween(50, 200);
        userData.wallet = Number(userData.wallet || 0) + souls;
        return { rarity, type: double ? 'double_souls' : 'souls', souls };
    }

    if (rarity === 'Rare') {
        if (Math.random() < 0.5) return { rarity, type: 'xp_boost' };
        return { rarity, type: 'bank_protection' };
    }

    if (rarity === 'Epic') {
        if (Math.random() < 0.5) {
            userData.bankLevel = Number(userData.bankLevel || 0) + 1;
            userData.upgrades = userData.upgrades || {};
            userData.upgrades.bank_upgrade = userData.bankLevel;
            return { rarity, type: 'bank_capacity', increase: 50000, bankLevel: userData.bankLevel };
        }

        userData.shards = Number(userData.shards || 0) + 1;
        return { rarity, type: 'shard', shards: 1 };
    }

    if (rarity === 'Legendary') {
        const character = pickCharacter(FOUR_STAR_CHARACTERS);
        if (!character) {
            userData.wallet = Number(userData.wallet || 0) + 100;
            return { rarity, type: 'souls', souls: 100 };
        }
        if (Number(userData.characters?.[character.name] || 0) > 0) {
            return convertDuplicate(userData, character);
        }
        addCharacter(userData, character.name);
        return { rarity, type: 'character', character };
    }

    if (rarity === 'Mystic') {
        const character = pickCharacter(FIVE_STAR_CHARACTERS);
        if (!character) {
            userData.wallet = Number(userData.wallet || 0) + 100;
            return { rarity, type: 'souls', souls: 100 };
        }
        if (Number(userData.characters?.[character.name] || 0) > 0) {
            return convertDuplicate(userData, character);
        }
        addCharacter(userData, character.name);
        return { rarity, type: 'character', character };
    }

    userData.wallet = Number(userData.wallet || 0) + 50;
    return { rarity: 'Common', type: 'souls', souls: 50 };
}

function rewardText(reward) {
    switch (reward.type) {
        case 'souls': return `${SOULS_EMOJI} **${reward.souls.toLocaleString()} Souls**`;
        case 'double_souls': return `${DOUBLE_SOULS_EMOJI} **${reward.souls.toLocaleString()} Souls**`;
        case 'xp_boost': return '⚡ **XP Booster — 24 Hours**';
        case 'bank_protection': return `🛡️ **Bank Protection — ${reward.hours || 24} Hours**`;
        case 'bank_capacity': return `🏦 **+${reward.increase.toLocaleString()} Bank Capacity**`;
        case 'shard': return `${SHARD_EMOJI} **1 Shard**`;
        case 'duplicate_conversion': return `🔁 **${reward.character.name} duplicate → ${SHARD_EMOJI} 2 Shards**`;
        case 'character': return `✨ **${reward.character.stars}★ ${reward.character.name}** — ${reward.character.rarity}`;
        default: return 'Unknown reward';
    }
}

function createGachaButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gacha:1:${userId}`)
            .setLabel('1 SPIN')
            .setEmoji(SHARD_BUTTON_EMOJI)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`gacha:10:${userId}`)
            .setLabel('10 SPINS')
            .setEmoji(SHARD_BUTTON_EMOJI)
            .setStyle(ButtonStyle.Success)
    );
}

async function performGacha(interaction, client, spins) {
    const cost = SPIN_COSTS[spins];
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const lockKey = `${guildId}:${userId}`;

    if (activeGachaSpins.has(lockKey)) {
        return {
            success: false,
            content: '⏳ Your previous gacha spin is still processing. Please wait a moment.'
        };
    }

    activeGachaSpins.add(lockKey);

    try {
        const userData = await getEconomyData(client, guildId, userId);
        const shards = Number(userData.shards || 0);

        if (shards < cost) {
            return {
                success: false,
                content: `❌ You need **${cost} ${SHARD_EMOJI} Shard${cost > 1 ? 's' : ''}** to spin, but you only have **${shards}**.`
            };
        }

        userData.shards = shards - cost;
        const rewards = [];
        const attachments = [];

        for (let i = 0; i < spins; i += 1) {
            const reward = grantReward(userData);
            rewards.push(reward);
            if (reward.type === 'character') attachments.push(createCharacterAttachment(reward.character));
        }

        // 1 Spin = 0 XP. 10 Spins = 5 XP total.
        if (spins === 10) {
            await addLevelXp(client, guildId, userId, 5);
        }

        if (rewards.some(reward => reward.type === 'xp_boost')) {
            await setXpMultiplier(client, guildId, userId, 2, 24 * 60 * 60 * 1000);
        }

        if (rewards.some(reward => reward.type === 'bank_protection')) {
            const bonuses = getCharacterBonuses(userData);
            const hours = 24 + Number(bonuses.bankProtectionHours || 0);
            const now = Date.now();
            const currentExpiry = Number(userData.bankProtectionExpiresAt || 0);
            userData.bankProtectionExpiresAt = Math.max(now, currentExpiry) + (hours * 60 * 60 * 1000);

            for (const reward of rewards) {
                if (reward.type === 'bank_protection') reward.hours = hours;
            }
        }

        await setEconomyData(client, guildId, userId, userData);

        const characters = rewards.filter(reward => reward.type === 'character');
        const mystic = characters.some(reward => reward.character.stars === 5);
        const legendary = characters.some(reward => reward.character.stars === 4);
        const lines = rewards.map((reward, index) => `**${index + 1}.** ${rewardText(reward)}`);

        const embed = new EmbedBuilder()
            .setColor(mystic ? 0x9B59FF : legendary ? 0xFFD700 : 0x168BFF)
            .setTitle(`${SHARD_EMOJI} 🎉 CONGRATULATIONS!`)
            .setDescription(`**You got this reward!**\n\n${lines.join('\n')}`)
            .addFields(
                {
                    name: `${SHARD_EMOJI} Spent`,
                    value: `**${cost} Shard${cost > 1 ? 's' : ''}**`,
                    inline: true
                },
                {
                    name: '⭐ XP Earned',
                    value: `**+${spins === 10 ? 5 : 0} XP**`,
                    inline: true
                },
                {
                    name: 'Remaining Shards',
                    value: `${SHARD_EMOJI} **${userData.shards.toLocaleString()}**`,
                    inline: true
                }
            )
            .setFooter({ text: 'Duplicate characters are automatically converted into 2 Shards.' });

        return { success: true, embed, attachments };
    } finally {
        activeGachaSpins.delete(lockKey);
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('gacha')
        .setDescription('Open the Spin and Win gacha menu.'),

    category: 'Games',

    async execute(interaction, config, client) {
        const banner = new AttachmentBuilder(GACHA_BANNER, { name: 'Spin and Win.png' });

        await interaction.reply({
            content: `${SHARD_EMOJI} **SPIN AND WIN**\nSpend Shards to summon characters and rare rewards!`,
            files: [banner],
            components: [createGachaButtons(interaction.user.id)]
        });

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({
            time: 10 * 60 * 1000,
            filter: buttonInteraction => buttonInteraction.customId.endsWith(`:${interaction.user.id}`)
        });

        collector.on('collect', async buttonInteraction => {
            const spins = Number(buttonInteraction.customId.split(':')[1]);

            if (!SPIN_COSTS[spins]) {
                return buttonInteraction.reply({ content: '❌ Invalid gacha spin.', ephemeral: true });
            }

            await buttonInteraction.deferUpdate();

            try {
                const result = await performGacha(buttonInteraction, client, spins);

                if (!result.success) {
                    await buttonInteraction.followUp({ content: result.content, ephemeral: true });
                    return;
                }

                const payload = { embeds: [result.embed] };
                if (result.attachments.length) payload.files = result.attachments;
                await buttonInteraction.followUp(payload);
            } catch (error) {
                console.error('[GACHA BUTTON ERROR]', error);
                await buttonInteraction.followUp({
                    content: '❌ Something went wrong while processing your gacha spin.',
                    ephemeral: true
                });
            }
        });

        collector.on('end', async () => {
            try {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`gacha:1:disabled:${interaction.user.id}`)
                        .setLabel('1 SPIN')
                        .setEmoji(SHARD_BUTTON_EMOJI)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`gacha:10:disabled:${interaction.user.id}`)
                        .setLabel('10 SPINS')
                        .setEmoji(SHARD_BUTTON_EMOJI)
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                );

                await interaction.editReply({ components: [disabledRow] });
            } catch {
                // Original message may have been deleted.
            }
        });
    }
};