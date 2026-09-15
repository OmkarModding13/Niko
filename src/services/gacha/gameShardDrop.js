import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getCharacterBonuses } from './characters.js';

export async function tryAwardGameShard(client, guildId, userId) {
    const userData = await getEconomyData(client, guildId, userId);
    if (!userData) return false;

    const bonuses = getCharacterBonuses(userData);
    const luck = Math.max(0, Number(bonuses.gameLuckBonus || 0));
    const chance = Math.min(0.05, 0.01 + (luck / 100));

    if (Math.random() >= chance) return false;

    userData.shards = Number(userData.shards || 0) + 1;
    await setEconomyData(client, guildId, userId, userData);
    return true;
}
