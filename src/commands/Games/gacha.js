import {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder
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

const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHARACTER_IMAGE_DIR = path.join(__dirname, '../../assets/gacha/Characters');

const SPIN_COSTS = { 1: 1, 10: 10 };

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedRarity(userData) {
    const bonuses = getCharacterBonuses(userData);
    const luck = Math.max(0, Number(bonuses.gachaLuckBonus || 0));
    const weights = GACHA_REWARD_WEIGHTS.map(item => ({ ...item }));

    for (const item of weights) {
        if (item.rarity === 'Legendary' || item.rarity === 'Mystic') {
            item.weight += luck;
        }
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
    const imagePath = path.join(CHARACTER_IMAGE_DIR, character.image);
    return new AttachmentBuilder(imagePath, { name: character.image });
}

function applyTemporaryXpBoost(userData) {
    const now = Date.now();
    const currentExpiry = Number(userData.xpMultiplierExpiresAt || 0);
    const start = Math.max(now, currentExpiry);

    userData.xpMultiplier = 2;
    userData.xpMultiplierExpiresAt = start + (24 * 60 * 60 * 1000);
    return userData.xpMultiplierExpiresAt;
}

function applyBankProtection(userData) {
    const now = Date.now();
    const bonuses = getCharacterBonuses(userData);
    const hours = 24 + Number(bonuses.bankProtectionHours || 0);
    const currentExpiry = Number(userData.bankProtectionExpiresAt || 0);
    const start = Math.max(now, currentExpiry);

    userData.bankProtectionExpiresAt = start + (hours * 60 * 60 * 1000);
    return hours;
}

function convertDuplicate(userData, character, stars) {
    userData.wallet = Number(userData.wallet || 0) + 100;
    return {
        rarity: character.rarity,
        type: 'duplicate_conversion',
        souls: 100,
        character,
        stars
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
        if (Math.random() < 0.5) {
            return { rarity, type: 'xp_boost', expiresAt: applyTemporaryXpBoost(userData) };
        }

        return { rarity, type: 'bank_protection', hours: applyBankProtection(userData) };
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
        const owned = Number(userData.characters?.[character.name] || 0) > 0;

        if (owned) return convertDuplicate(userData, character, 4);

        addCharacter(userData, character.name);
        return { rarity, type: 'character', character };
    }

    if (rarity === 'Mystic') {
        const character = pickCharacter(FIVE_STAR_CHARACTERS);
        const owned = Number(userData.characters?.[character.name] || 0) > 0;

        if (owned) return convertDuplicate(userData, character, 5);

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
        case 'bank_protection': return `🛡️ **Bank Protection — ${reward.hours} Hours**`;
        case 'bank_capacity': return `🏦 **+${reward.increase.toLocaleString()} Bank Capacity**`;
        case 'shard': return `${SHARD_EMOJI} **1 Shard**`;
        case 'duplicate_conversion': return `🔁 **${reward.character.name} duplicate → ${SOULS_EMOJI} 100 Souls**`;
        case 'character': return `✨ **${reward.character.stars}★ ${reward.character.name}** — ${reward.character.rarity}`;
        default: return 'Unknown reward';
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('gacha')
        .setDescription('Spend Shards to summon characters and rare rewards.')
        .addIntegerOption(option => option
            .setName('spins')
            .setDescription('Choose how many Shard spins to use.')
            .setRequired(true)
            .addChoices(
                { name: '1 Spin — 1 Shard', value: 1 },
                { name: '10 Spins — 10 Shards', value: 10 }
            )
        ),

    category: 'Games',

    async execute(interaction, config, client) {
        const spins = interaction.options.getInteger('spins', true);
        const cost = SPIN_COSTS[spins];
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const userData = await getEconomyData(client, guildId, userId);
        const shards = Number(userData.shards || 0);

        if (shards < cost) {
            return interaction.reply({
                content: `❌ You need **${cost} ${SHARD_EMOJI} Shard${cost > 1 ? 's' : ''}** to spin, but you only have **${shards}**.`,
                ephemeral: true
            });
        }

        userData.shards = shards - cost;
        const rewards = [];
        const attachments = [];

        for (let i = 0; i < spins; i += 1) {
            const reward = grantReward(userData);
            rewards.push(reward);
            if (reward.type === 'character') attachments.push(createCharacterAttachment(reward.character));
        }

        await setEconomyData(client, guildId, userId, userData);

        const characters = rewards.filter(reward => reward.type === 'character');
        const mystic = characters.some(reward => reward.character.stars === 5);
        const legendary = characters.some(reward => reward.character.stars === 4);

        const lines = rewards.map((reward, index) => `**${index + 1}.** ${rewardText(reward)}`);

        const embed = new EmbedBuilder()
            .setColor(mystic ? 0x9B59FF : legendary ? 0xFFD700 : 0x168BFF)
            .setTitle(spins === 10 ? '🎰 GACHA ×10' : '🎰 GACHA SPIN')
            .setDescription(`${SHARD_EMOJI} Spent **${cost} Shard${cost > 1 ? 's' : ''}**.\n\n${lines.join('\n')}`)
            .addFields({
                name: `${TOTAL_SOULS_EMOJI} Remaining Shards`,
                value: `${SHARD_EMOJI} **${userData.shards.toLocaleString()}**`,
                inline: true
            })
            .setFooter({ text: 'Duplicate characters are automatically converted into 100 Souls.' });

        const reply = { embeds: [embed] };
        if (attachments.length) reply.files = attachments;

        return interaction.reply(reply);
    }
};
