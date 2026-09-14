import { getEconomyData, setEconomyData } from '../../../utils/economy.js';

export const SOULS_EMOJI = '<:Souls:1547510037621112894>';
export const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
export const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
export const SHARD_EMOJI = '<:Shard:1548962748321374218>';

export const GAME_COOLDOWN = 10 * 1000;

const lastPlayed = new Map();

export const GAME_CONFIG = {
    soulflip: { name: 'Soul Flip', entry: 100 },
    abyssdice: { name: 'Abyss Dice', entry: 250 },
    soulslots: { name: 'Soul Slots', entry: 500 },
    higherlower: { name: 'Higher or Lower', entry: 150 },
    diceduel: { name: 'Dice Duel', entry: 300 },
    numberguess: { name: 'Number Guess', entry: 200 },
};

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function rollReward(entry) {
    const roll = Math.random();

    // Ultra Rare: 0.5% — 1 Shard.
    if (roll < 0.005) {
        return { type: 'shard', souls: 0, shards: 1 };
    }

    // Rare: 14.5% total.
    // 7.0% Double Souls, 7.5% Extra Souls (3x entry).
    if (roll < 0.075) {
        return { type: 'double', souls: entry * 2, shards: 0 };
    }

    if (roll < 0.15) {
        return { type: 'extra', souls: entry * 3, shards: 0 };
    }

    // Common win: 85%.
    return { type: 'common', souls: Math.floor(entry * 1.25), shards: 0 };
}

export async function playGame(client, interaction, gameKey, gameResult = {}) {
    const config = GAME_CONFIG[gameKey];
    if (!config) throw new Error(`Unknown game: ${gameKey}`);

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const cooldownKey = `${guildId}:${userId}:${gameKey}`;
    const now = Date.now();
    const last = lastPlayed.get(cooldownKey) || 0;

    if (now - last < GAME_COOLDOWN) {
        const remaining = Math.ceil((GAME_COOLDOWN - (now - last)) / 1000);
        return {
            ok: false,
            message: `⏳ Slow down! You can play **${config.name}** again in **${remaining}s**.`,
        };
    }

    const userData = await getEconomyData(client, guildId, userId);
    const wallet = Number(userData.wallet || 0);

    if (wallet < config.entry) {
        return {
            ok: false,
            message: `❌ You need **${formatNumber(config.entry)} ${SOULS_EMOJI}** to play **${config.name}**. You only have **${formatNumber(wallet)} ${SOULS_EMOJI}**.`,
        };
    }

    lastPlayed.set(cooldownKey, now);
    userData.wallet = wallet - config.entry;

    // Losing is a common game outcome. A loser gets no reward.
    // Winning rolls the reward tier: Common → Rare → Ultra Rare.
    const reward = gameResult.forceLoss
        ? { type: 'loss', souls: 0, shards: 0 }
        : rollReward(config.entry);

    userData.shards = Number(userData.shards || 0) + reward.shards;
    userData.wallet += reward.souls;

    const result = {
        ...reward,
        entry: config.entry,
        balance: userData.wallet,
        shards: userData.shards,
        ...gameResult,
    };

    await setEconomyData(client, guildId, userId, userData);
    return { ok: true, result };
}

export function resultText(result) {
    if (result.type === 'shard') {
        return {
            title: `${SHARD_EMOJI} ULTRA RARE DROP!`,
            description: `${SHARD_EMOJI} **1 Shard** has been awarded to you!\n\nThat is the rarest game reward. **1 Shard = 1,000 Souls worth.**`,
        };
    }

    if (result.type === 'double') {
        return {
            title: `${DOUBLE_SOULS_EMOJI} DOUBLE SOULS!`,
            description: `You won **${formatNumber(result.souls)} ${SOULS_EMOJI}**!\nYour entry fee was doubled.`,
        };
    }

    if (result.type === 'extra') {
        return {
            title: `${SOULS_EMOJI} EXTRA SOULS!`,
            description: `You won **${formatNumber(result.souls)} ${SOULS_EMOJI}**!\nA rare **3× payout**!`,
        };
    }

    if (result.type === 'common') {
        return {
            title: `${SOULS_EMOJI} SOULS FOUND!`,
            description: `You won **${formatNumber(result.souls)} ${SOULS_EMOJI}**!`,
        };
    }

    return {
        title: '💔 BETTER LUCK NEXT TIME',
        description: `The Abyss took your **${formatNumber(result.entry)} ${SOULS_EMOJI}**.\nCome back and try again.`,
    };
}

export function balanceFooter(result) {
    return `${TOTAL_SOULS_EMOJI} Souls: ${formatNumber(result.balance)}  •  ${SHARD_EMOJI} Shards: ${formatNumber(result.shards)}`;
}
