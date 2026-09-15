import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';

import { shopItems } from '../../../config/shop/items.js';
import { getColor } from '../../../config/bot.js';
import { getEconomyData, setEconomyData } from '../../../utils/economy.js';
import { logger } from '../../../utils/logger.js';
import { getCharacterBonuses } from '../../../services/gacha/characters.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_EMOJI = '<:Total:1547545479628333086>';

const CATEGORIES = {
    color_roles: {
        name: 'Color Roles',
        emoji: '🎨',
        description: 'Temporary color roles for 7 days.',
        types: ['role']
    },
    upgrades: {
        name: 'Upgrades',
        emoji: '🏦',
        description: 'Permanent bank capacity upgrades.',
        types: ['upgrade']
    },
    boosts: {
        name: 'Boosts & Protection',
        emoji: '⚡',
        description: 'Temporary power-ups for your account.',
        types: ['boost', 'protection']
    }
};

const ITEM_EMOJIS = {
    color_red: '🔴',
    color_pink: '🩷',
    color_purple: '🟣',
    color_cyan: '🩵',
    color_black: '⚫',
    color_lime: '🟢',
    color_yellow: '🟡',
    bank_upgrade: '🏦',
    xp_boost_24h: '⚡',
    bank_protection_24h: '🛡️'
};

function getItemsForCategory(categoryId) {
    const category = CATEGORIES[categoryId];
    if (!category) return [];
    return shopItems.filter(item => category.types.includes(item.type));
}

function getDisplayName(item) {
    return String(item.name || item.id)
        .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '')
        .trim();
}

function getPrice(item, userData = null) {
    if (item.effect?.type === 'bank_capacity') {
        const bankLevel = Number(userData?.bankLevel || 0);
        return 3000 + (bankLevel * 1000);
    }
    return item.price || 0;
}

function getItemDescription(item) {
    if (item.effect?.type === 'temporary_color_role') return 'Temporary color role for 7 days.';
    if (item.effect?.type === 'bank_capacity') return 'Increase your bank capacity by 50,000 Souls.';
    if (item.effect?.type === 'xp_boost') return 'Double XP earned for 24 hours.';
    if (item.effect?.type === 'bank_protection') return 'Protect your wallet from Bank Robbery for 24 hours. Character abilities can extend this duration.';
    return item.description || '';
}

function createShopEmbed(categoryId, userData) {
    const category = CATEGORIES[categoryId];
    const items = getItemsForCategory(categoryId);

    const embed = new EmbedBuilder()
        .setTitle('🛒 Hollow Devil Shop')
        .setColor(getColor('primary'))
        .setDescription('Spend your Souls on exclusive rewards, upgrades and temporary boosts.');

    embed.addFields({
        name: `${category.emoji} ${category.name}`,
        value: category.description,
        inline: false
    });

    for (const item of items) {
        const emoji = ITEM_EMOJIS[item.id] || '🛍️';
        const price = getPrice(item, userData);

        embed.addFields({
            name: `${emoji} ${getDisplayName(item)} — ${SOULS_EMOJI} ${price.toLocaleString()}`,
            value: getItemDescription(item),
            inline: false
        });
    }

    embed.addFields({
        name: `${TOTAL_EMOJI} Balance`,
        value: `${SOULS_EMOJI} ${Number(userData?.wallet || 0).toLocaleString()} Souls`,
        inline: false
    });

    embed.setFooter({ text: 'Select a category, then select an item to purchase.' });
    return embed;
}

function createCategoryMenu(selectedCategory) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('shop_category')
            .setPlaceholder('Select a category...')
            .addOptions(
                Object.entries(CATEGORIES).map(([id, category]) => ({
                    label: category.name,
                    value: id,
                    description: category.description.substring(0, 100),
                    emoji: category.emoji,
                    default: id === selectedCategory
                }))
            )
    );
}

function createItemMenu(categoryId, userData = null) {
    const items = getItemsForCategory(categoryId);

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('shop_item')
            .setPlaceholder('Select an item to purchase...')
            .addOptions(
                items.map(item => ({
                    label: getDisplayName(item),
                    value: item.id,
                    description: `${getPrice(item, userData).toLocaleString()} Souls`,
                    emoji: ITEM_EMOJIS[item.id] || '🛍️'
                }))
            )
    );
}

function createPurchaseButtons(itemId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`shop_purchase_${itemId}`)
            .setLabel('Purchase')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('shop_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );
}

export default {
    async execute(interaction, config, client) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            let currentCategory = 'color_roles';
            let selectedItemId = null;

            const getFreshUserData = () => getEconomyData(client, guildId, userId);
            let userData = await getFreshUserData();

            const getComponents = () => {
                const rows = [
                    createCategoryMenu(currentCategory),
                    createItemMenu(currentCategory, userData)
                ];
                if (selectedItemId) rows.push(createPurchaseButtons(selectedItemId));
                return rows;
            };

            await interaction.reply({
                embeds: [createShopEmbed(currentCategory, userData)],
                components: getComponents()
            });

            const message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async componentInteraction => {
                try {
                    if (componentInteraction.user.id !== userId) {
                        await componentInteraction.reply({
                            content: '❌ This shop belongs to someone else. Use `/shop` to open your own shop.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    if (componentInteraction.customId === 'shop_category') {
                        currentCategory = componentInteraction.values[0];
                        selectedItemId = null;
                        userData = await getFreshUserData();

                        await componentInteraction.update({
                            embeds: [createShopEmbed(currentCategory, userData)],
                            components: getComponents()
                        });
                        return;
                    }

                    if (componentInteraction.customId === 'shop_item') {
                        selectedItemId = componentInteraction.values[0];
                        userData = await getFreshUserData();

                        const item = shopItems.find(shopItem => shopItem.id === selectedItemId);
                        if (!item) {
                            await componentInteraction.reply({
                                content: '❌ This item no longer exists.',
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const price = getPrice(item, userData);
                        const balance = Number(userData.wallet || 0);
                        const emoji = ITEM_EMOJIS[item.id] || '🛍️';

                        const embed = new EmbedBuilder()
                            .setTitle(`${emoji} ${getDisplayName(item)}`)
                            .setColor(getColor('primary'))
                            .setDescription(getItemDescription(item))
                            .addFields(
                                {
                                    name: 'Price',
                                    value: `${SOULS_EMOJI} ${price.toLocaleString()} Souls`,
                                    inline: true
                                },
                                {
                                    name: 'Balance',
                                    value: `${TOTAL_EMOJI} ${balance.toLocaleString()} Souls`,
                                    inline: true
                                }
                            );

                        if (item.effect?.type === 'temporary_color_role') {
                            embed.addFields({ name: 'Duration', value: '7 Days', inline: true });
                        }

                        if (item.effect?.type === 'xp_boost') {
                            embed.addFields({ name: 'Duration', value: '24 Hours • 2× XP', inline: true });
                        }

                        if (item.effect?.type === 'bank_protection') {
                            const bonuses = getCharacterBonuses(userData);
                            const hours = 24 + Number(bonuses.bankProtectionHours || 0);
                            embed.addFields({ name: 'Duration', value: `${hours} Hours`, inline: true });
                        }

                        if (item.effect?.type === 'bank_capacity') {
                            embed.addFields({ name: 'Upgrade', value: '+50,000 Bank Capacity', inline: true });
                        }

                        embed.addFields({
                            name: 'Status',
                            value: balance < price
                                ? `❌ You need ${SOULS_EMOJI} ${(price - balance).toLocaleString()} more Souls.`
                                : '✅ You can afford this item.',
                            inline: false
                        });

                        await componentInteraction.update({
                            embeds: [embed],
                            components: getComponents()
                        });
                        return;
                    }

                    if (componentInteraction.customId === 'shop_cancel') {
                        selectedItemId = null;
                        userData = await getFreshUserData();

                        await componentInteraction.update({
                            embeds: [createShopEmbed(currentCategory, userData)],
                            components: getComponents()
                        });
                        return;
                    }

                    if (!componentInteraction.customId.startsWith('shop_purchase_')) return;

                    const itemId = componentInteraction.customId.replace('shop_purchase_', '');
                    const item = shopItems.find(shopItem => shopItem.id === itemId);

                    if (!item) {
                        await componentInteraction.reply({
                            content: '❌ This item no longer exists.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    userData = await getFreshUserData();
                    const price = getPrice(item, userData);
                    const balance = Number(userData.wallet || 0);

                    if (balance < price) {
                        await componentInteraction.reply({
                            content: `❌ You don't have enough Souls. You need **${SOULS_EMOJI} ${price.toLocaleString()} Souls** but only have **${TOTAL_EMOJI} ${balance.toLocaleString()} Souls**.`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    if (item.effect?.type === 'temporary_color_role') {
                        if (userData.activeColorRole) {
                            await componentInteraction.reply({
                                content: '❌ You already have an active temporary color role. Wait until it expires before purchasing another one.',
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const roleName = getDisplayName(item);
                        const role = interaction.guild.roles.cache.find(
                            guildRole => guildRole.name.toLowerCase() === roleName.toLowerCase()
                        );

                        if (!role) {
                            await componentInteraction.reply({
                                content: `❌ The **${roleName}** role was not found in this server.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const member = await interaction.guild.members.fetch(userId);

                        try {
                            await member.roles.add(role, `Purchased ${roleName} color role`);
                        } catch (roleError) {
                            logger.error('[SHOP] Failed to assign color role:', roleError);
                            await componentInteraction.reply({
                                content: '❌ I could not give you the role. Your Souls were not deducted.',
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        userData.wallet -= price;
                        userData.activeColorRole = {
                            roleId: role.id,
                            roleName: role.name,
                            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
                        };
                    } else if (item.effect?.type === 'bank_capacity') {
                        userData.wallet -= price;
                        userData.bankLevel = Number(userData.bankLevel || 0) + 1;
                        userData.upgrades = userData.upgrades || {};
                        userData.upgrades.bank_upgrade = userData.bankLevel;
                    } else if (item.effect?.type === 'xp_boost') {
                        const now = Date.now();
                        const currentExpiry = Number(userData.xpMultiplierExpiresAt || 0);
                        const start = Math.max(now, currentExpiry);

                        userData.wallet -= price;
                        userData.xpMultiplier = 2;
                        userData.xpMultiplierExpiresAt = start + (24 * 60 * 60 * 1000);
                    } else if (item.effect?.type === 'bank_protection') {
                        const now = Date.now();
                        const bonuses = getCharacterBonuses(userData);
                        const hours = 24 + Number(bonuses.bankProtectionHours || 0);
                        const currentExpiry = Number(userData.bankProtectionExpiresAt || 0);
                        const start = Math.max(now, currentExpiry);

                        userData.wallet -= price;
                        userData.bankProtectionExpiresAt = start + (hours * 60 * 60 * 1000);
                    } else {
                        await componentInteraction.reply({
                            content: '❌ This item has no valid purchase effect.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    await setEconomyData(client, guildId, userId, userData);
                    selectedItemId = null;

                    await componentInteraction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🎉 Purchase Successful')
                                .setColor(getColor('success'))
                                .setDescription(`You purchased **${getDisplayName(item)}**.`)
                                .addFields({
                                    name: 'Paid',
                                    value: `${SOULS_EMOJI} ${price.toLocaleString()} Souls`,
                                    inline: true
                                }, {
                                    name: 'New Balance',
                                    value: `${TOTAL_EMOJI} ${Number(userData.wallet || 0).toLocaleString()} Souls`,
                                    inline: true
                                })
                        ],
                        components: getComponents()
                    });
                } catch (error) {
                    logger.error('[SHOP] Component interaction failed:', error);
                    if (!componentInteraction.replied && !componentInteraction.deferred) {
                        await componentInteraction.reply({
                            content: '❌ Something went wrong while processing that shop action.',
                            flags: MessageFlags.Ephemeral
                        }).catch(() => {});
                    }
                }
            });
        } catch (error) {
            logger.error('[SHOP] Shop failed:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Something went wrong while opening the shop.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};
