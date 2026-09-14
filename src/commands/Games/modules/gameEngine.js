import { getEconomyData, setEconomyData } from '../../../utils/economy.js';

export const SOULS_EMOJI = '<:Souls:1547510037621112894>';
export const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
export const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
export const SHARD_EMOJI = '<:Shard:1548962748321374218>';

export const GAME_COOLDOWN = 10 * 1000;
const lastPlayed = new Map();

export const GAME_CONFIG = {
    quickcoin: { name: 'Quick Coin', entry: 20, maxReward: 100, starter: true },
    rps: { name: 'Rock Paper Scissors', entry: 30, maxReward: 100, starter: true },
    abyssdice: { name: 'Abyss Dice', entry: 30, maxReward: 100, starter: true },
    soulflip: { name: 'Soul Flip', entry: 50, maxReward: 150 },
    diceduel: { name: 'Dice Duel', entry: 100, maxReward: 300 },
    soulslots: { name: 'Soul Slots', entry: 150, maxReward: 450 },
};

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollReward(config) {
    const roll = Math.random();
    if (roll < 0.005) return { type: 'shard', souls: 0, shards: 1 };
    if (roll < 0.075) return { type: 'double', souls: Math.min(config.entry * 2, config.maxReward), shards: 0 };
    if (roll < 0.15) return { type: 'extra', souls: Math.min(config.entry * 3, config.maxReward), shards: 0 };
    return { type: 'common', souls: randomBetween(config.entry, config.maxReward), shards: 0 };
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
        return { ok: false, message: `⏳ Slow down! You can play **${config.name}** again in **${remaining}s**.` };
    }

    const userData = await getEconomyData(client, guildId, userId);
    const wallet = Number(userData.wallet || 0);

    if (wallet < config.entry) {
        return {
            ok: false,
            message: `❌ You need **${formatNumber(config.entry)} ${SOULS_EMOJI}** to play **${config.name}**. You only have **${formatNumber(wallet)} ${SOULS_EMOJI}**.`,
        };
    }

    if (gameResult.draw) {
        await setEconomyData(client, guildId, userId, userData);
        return {
            ok: true,
            result: {
                type: 'draw',
                entry: config.entry,
                balance: wallet,
                shards: Number(userData.shards || 0),
                ...gameResult,
            },
        };
    }

    lastPlayed.set(cooldownKey, now);
    userData.wallet = wallet - config.entry;

    const reward = gameResult.forceLoss
        ? { type: 'loss', souls: 0, shards: 0 }
        : rollReward(config);

    userData.shards = Number(userData.shards || 0) + reward.shards;
    userData.wallet += reward.souls;

    const result = {
        ...reward,
        entry: config.entry,
        maxReward: config.maxReward,
        balance: userData.wallet,
        shards: userData.shards,
        ...gameResult,
    };

    await setEconomyData(client, guildId, userId, userData);
    return { ok: true, result };
}

export function resultText(result) {
    if (result.type === 'shard') return {
        title: `${SHARD_EMOJI} ULTRA RARE DROP!`,
        description: `${SHARD_EMOJI} **1 Shard** has been awarded to you!\n\nThat is the rarest game reward. **1 Shard = 1,000 Souls worth.**`,
    };
    if (result.type === 'double') return {
        title: `${DOUBLE_SOULS_EMOJI} DOUBLE SOULS!`,
        description: `You won **${formatNumber(result.souls)} ${SOULS_EMOJI}**!\nYour entry fee was doubled.`,
    };
    if (result.type === 'extra') return {
        title: `${SOULS_EMOJI} EXTRA SOULS!`,
        description: `You won **${formatNumber(result.souls)} ${SOULS_EMOJI}**!\nA rare **bonus payout**!`,
    };
    if (result.type === 'common') return {
        title: `${SOULS_EMOJI} SOULS FOUND!`,
        description: `You won **${formatNumber(result.souls)} ${SOULS_EMOJI}**!`,
    };
    if (result.type === 'draw') return {
        title: '🤝 DRAW!',
        description: `Your **${formatNumber(result.entry)} ${SOULS_EMOJI}** entry fee has been **refunded**.\nYou can play again immediately.`,
    };
    return {
        title: '💔 BETTER LUCK NEXT TIME',
        description: `The Abyss took your **${formatNumber(result.entry)} ${SOULS_EMOJI}**.\nCome back and try again.`,
    };
}

export function balanceFooter(result) {
    return `${TOTAL_SOULS_EMOJI} Souls: ${formatNumber(result.balance)}  •  ${SHARD_EMOJI} Shards: ${formatNumber(result.shards)}`;
}
