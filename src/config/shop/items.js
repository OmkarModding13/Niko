export const shopItems = [
    // =========================
    // COLOR ROLES
    // =========================

    {
        id: 'color_red',
        name: '🔴 Red',
        price: 350,
        description: 'Temporary Red color role for 7 days.',
        type: 'role',
        duration: 7 * 24 * 60 * 60 * 1000,
        roleId: null,
        effect: { type: 'temporary_color_role', color: '#FF0000' }
    },
    {
        id: 'color_pink',
        name: '🩷 Pink',
        price: 350,
        description: 'Temporary Pink color role for 7 days.',
        type: 'role',
        duration: 7 * 24 * 60 * 60 * 1000,
        roleId: null,
        effect: { type: 'temporary_color_role', color: '#FF69B4' }
    },
    {
        id: 'color_purple',
        name: '🟣 Purple',
        price: 350,
        description: 'Temporary Purple color role for 7 days.',
        type: 'role',
        duration: 7 * 24 * 60 * 60 * 1000,
        roleId: null,
        effect: { type: 'temporary_color_role', color: '#8000FF' }
    },
    {
        id: 'color_cyan',
        name: '🩵 Cyan',
        price: 350,
        description: 'Temporary Cyan color role for 7 days.',
        type: 'role',
        duration: 7 * 24 * 60 * 60 * 1000,
        roleId: null,
        effect: { type: 'temporary_color_role', color: '#00FFFF' }
    },
    {
        id: 'color_black',
        name: '⚫ Black',
        price: 350,
        description: 'Temporary Black color role for 7 days.',
        type: 'role',
        duration: 7 * 24 * 60 * 60 * 1000,
        roleId: null,
        effect: { type: 'temporary_color_role', color: '#000000' }
    },
    {
        id: 'color_lime',
        name: '🟢 Lime',
        price: 350,
        description: 'Temporary Lime color role for 7 days.',
        type: 'role',
        duration: 7 * 24 * 60 * 60 * 1000,
        roleId: null,
        effect: { type: 'temporary_color_role', color: '#32CD32' }
    },
    {
        id: 'color_yellow',
        name: '🟡 Yellow',
        price: 350,
        description: 'Temporary Yellow color role for 7 days.',
        type: 'role',
        duration: 7 * 24 * 60 * 60 * 1000,
        roleId: null,
        effect: { type: 'temporary_color_role', color: '#FFFF00' }
    },

    // =========================
    // PERMANENT UPGRADES
    // =========================

    {
        id: 'bank_upgrade',
        name: '🏦 Bank Capacity Upgrade',
        price: 3000,
        description: 'Increase your bank capacity by 50,000 Souls.',
        type: 'upgrade',
        effect: {
            type: 'bank_capacity',
            increase: 50000
        }
    },

    // =========================
    // TEMPORARY BOOSTS
    // =========================

    {
        id: 'xp_boost_24h',
        name: '⚡ XP Booster',
        price: 3000,
        description: 'Double XP earned for 24 hours.',
        type: 'boost',
        duration: 24 * 60 * 60 * 1000,
        effect: {
            type: 'xp_boost',
            multiplier: 2
        }
    },
    {
        id: 'bank_protection_24h',
        name: '🛡️ Bank Protection',
        price: 3000,
        description: 'Protect your wallet from Bank Robbery for 24 hours.',
        type: 'protection',
        duration: 24 * 60 * 60 * 1000,
        effect: {
            type: 'bank_protection',
            hours: 24
        }
    }
];

export function getItemById(itemId) {
    return shopItems.find(item => item.id === itemId);
}

export function getItemsByType(type) {
    return shopItems.filter(item => item.type === type);
}

export function getItemPrice(itemId) {
    const item = getItemById(itemId);
    return item ? item.price : 0;
}

export function validatePurchase(itemId, userData) {
    const item = getItemById(itemId);

    if (!item) {
        return { valid: false, reason: 'Item not found' };
    }

    return { valid: true };
}
