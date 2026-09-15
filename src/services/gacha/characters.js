export const CHARACTER_CATALOG = {
    Lumira: {
        name: 'Lumira',
        stars: 4,
        rarity: 'Legendary',
        image: 'Lumira.png',
        flexImage: 'OwnLumira.png',
        ability: 'Daily reward +5 Souls.',
        effects: { dailyBonus: 5 }
    },
    Seraphne: {
        name: 'Seraphne',
        stars: 4,
        rarity: 'Legendary',
        image: 'Seraphne.png',
        flexImage: 'OwnSeraphne.png',
        ability: 'Game reward luck +0.5%.',
        effects: { gameLuckBonus: 0.5 }
    },
    Niko: {
        name: 'Niko',
        stars: 5,
        rarity: 'Mystic',
        image: 'Niko.png',
        flexImage: 'OwnNiko.png',
        ability: 'Game Soul rewards +10%.',
        effects: { gameRewardBonus: 0.10 }
    },
    Valeris: {
        name: 'Valeris',
        stars: 5,
        rarity: 'Mystic',
        image: 'Valeris.png',
        flexImage: 'OwnValeris.png',
        ability: 'Bank Protection lasts +4 hours.',
        effects: { bankProtectionHours: 4 }
    },
    Eiris: {
        name: 'Eiris',
        stars: 5,
        rarity: 'Mystic',
        image: 'Eiris.png',
        flexImage: 'OwnEiris.png',
        ability: 'Gacha luck +1%.',
        effects: { gachaLuckBonus: 1 }
    },
    Carmine: {
        name: 'Carmine',
        stars: 5,
        rarity: 'Mystic',
        image: 'Carmine.png',
        flexImage: 'OwnCarmine.png',
        ability: 'Daily reward +10 Souls.',
        effects: { dailyBonus: 10 }
    }
};

export const GACHA_REWARD_WEIGHTS = [
    { rarity: 'Common', weight: 75 },
    { rarity: 'Rare', weight: 17 },
    { rarity: 'Epic', weight: 6 },
    { rarity: 'Legendary', weight: 1.8 },
    { rarity: 'Mystic', weight: 0.2 }
];

export const FOUR_STAR_CHARACTERS = Object.values(CHARACTER_CATALOG)
    .filter(character => character.stars === 4);

export const FIVE_STAR_CHARACTERS = Object.values(CHARACTER_CATALOG)
    .filter(character => character.stars === 5);

export function getOwnedCharacters(userData) {
    const owned = userData?.characters;
    return owned && typeof owned === 'object' ? owned : {};
}

export function getOwnedCharacterNames(userData) {
    return Object.keys(getOwnedCharacters(userData));
}

export function addCharacter(userData, characterName) {
    userData.characters = getOwnedCharacters(userData);
    const existing = Number(userData.characters[characterName] || 0);
    const duplicate = existing > 0;
    userData.characters[characterName] = existing + 1;
    return { duplicate, copies: userData.characters[characterName] };
}

export function getCharacterBonuses(userData) {
    const bonuses = {
        dailyBonus: 0,
        gameLuckBonus: 0,
        gameRewardBonus: 0,
        bankProtectionHours: 0,
        gachaLuckBonus: 0
    };

    for (const name of getOwnedCharacterNames(userData)) {
        const character = CHARACTER_CATALOG[name];
        if (!character?.effects) continue;

        for (const [key, value] of Object.entries(character.effects)) {
            bonuses[key] = (bonuses[key] || 0) + Number(value || 0);
        }
    }

    return bonuses;
}

export function getCharacterByName(name) {
    return CHARACTER_CATALOG[name] || null;
}

export function getCharactersByStars(stars) {
    return Object.values(CHARACTER_CATALOG)
        .filter(character => character.stars === stars);
}
