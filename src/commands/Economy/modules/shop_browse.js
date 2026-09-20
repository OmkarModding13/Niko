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
import { setXpMultiplier } from '../../../services/leveling/leveling.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_EMOJI = '<:Total:1547545479628333086>';

const CATEGORIES = {
    color_roles: {
        name: 'Color Roles',
        emoji: '🎨',
        description: 'Temporary color roles with 7-day, 1-month, 6-month and 1-year durations.',
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
    color_red_7d: '🔴', color_red_1m: '🔴', color_red_6m: '🔴', color_red_1y: '🔴',
    color_pink_7d: '🩷', color_pink_1m: '🩷', color_pink_6m: '🩷', color_pink_1y: '🩷',
    color_purple_7d: '🟣', color_purple_1m: '🟣', color_purple_6m: '🟣', color_purple_1y: '🟣',
    color_cyan_7d: '🩵', color_cyan_1m: '🩵', color_cyan_6m: '🩵', color_cyan_1y: '🩵',
    color_black_7d: '⚫', color_black_1m: '⚫', color_black_6m: '⚫', color_black_1y: '⚫',
    color_lime_7d: '🟢', color_lime_1m: '🟢', color_lime_6m: '🟢', color_lime_1y: '🟢',
    color_yellow_7d: '🟡', color_yellow_1m: '🟡', color_yellow_6m: '🟡', color_yellow_1y: '🟡',
    bank_upgrade: '🏦',
    xp_boost_24h: '⚡', bank_protection_24h: '🛡️'
};

function getItemsForCategory(categoryId) {
    const category = CATEGORIES[categoryId];
    if (!category) return [];

    const items = shopItems.filter(item => category.types.includes(item.type));

    if (categoryId === 'color_roles') {
        return items.filter(item => item.id.endsWith('_7d'));
    }

    return items;
}

function getColorTierItems(baseItemId) {
    if (!baseItemId?.startsWith('color_')) return [];
    const base = baseItemId.replace(/_(7d|1m|6m|1y)$/, '');
    return ['7d', '1m', '6m', '1y']
        .map(tier => shopItems.find(item => item.id === `${base}_${tier}`))
        .filter(Boolean);
}

function getDisplayName(item) {
    return String(item.name || item.id)
        .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '')
        .trim();
}

function getPrice(item, userData = null) {
    if (item.effect?.type === 'bank_capacity') {
        return 3000 + (Number(userData?.bankLevel || 0) * 1000);
    }
    return item.price || 0;
}

function getDurationText(item) {
    const duration = Number(item.duration || 0);

    if (!duration) return '';

    const totalHours = Math.round(duration / (60 * 60 * 1000));

    if (totalHours % 24 === 0) {
        const days = totalHours / 24;

        if (days === 7) return '1 Week';
        if (days === 30) return '1 Month';
        if (days === 180) return '6 Months';
        if (days === 365) return '1 Year';

        return days === 1 ? '1 Day' : `${days} Days`;
    }

    return totalHours === 1 ? '1 Hour' : `${totalHours} Hours`;
}

function getItemDescription(item) {
    if (item.effect?.type === 'temporary_color_role') {
        return `Temporary color role for ${getDurationText(item)}.`;
    }
    if (item.effect?.type === 'bank_capacity') return 'Increase your bank capacity by 50,000 Souls.';
    if (item.effect?.type === 'xp_boost') return 'Double XP earned for 24 hours.';
    if (item.effect?.type === 'bank_protection') return 'Protect your wallet from Bank Robbery for 1 hour. Character abilities can extend this duration.';
    return item.description || '';
}

function createShopEmbed(categoryId, userData) {
    const category = CATEGORIES[categoryId];
    const items = getItemsForCategory(categoryId);
    const embed = new EmbedBuilder()
        .setTitle('🛒 Hollow Devil Shop')
        .setColor(getColor('primary'))
        .setDescription('Spend your Souls on exclusive rewards, upgrades and temporary boosts.');

    embed.addFields({ name: `${category.emoji} ${category.name}`, value: category.description, inline: false });

    for (const item of items) {
        const price = getPrice(item, userData);
        embed.addFields({
            name: `${ITEM_EMOJIS[item.id] || '🛍️'} ${getDisplayName(item)} — ${SOULS_EMOJI} ${price.toLocaleString()}`,
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
            .addOptions(Object.entries(CATEGORIES).map(([id, category]) => ({
                label: category.name,
                value: id,
                description: category.description.substring(0, 100),
                emoji: category.emoji,
                default: id === selectedCategory
            })))
    );
}

function createItemMenu(categoryId, userData = null) {
    const items = getItemsForCategory(categoryId);
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('shop_item')
            .setPlaceholder('Select an item to purchase...')
            .addOptions(items.map(item => {
                const priceText = `${getPrice(item, userData).toLocaleString()} Souls`;
                const durationText = getDurationText(item);

                return {
                    label: getDisplayName(item),
                    value: item.id,
                    description: durationText
                        ? `${priceText} • ${durationText}`
                        : priceText,
                    emoji: ITEM_EMOJIS[item.id] || '🛍️'
                };
            }))
    );
}

function createPurchaseButtons(itemId) {
    if (itemId?.startsWith('color_')) {
        const tierItems = getColorTierItems(itemId);

        return new ActionRowBuilder().addComponents(
            ...tierItems.map(item =>
                new ButtonBuilder()
                    .setCustomId(`shop_purchase_${item.id}`)
                    .setLabel(`${getDurationText(item)} • ${getPrice(item).toLocaleString()}`)
                    .setStyle(ButtonStyle.Success)
            )
        );
    }

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`shop_purchase_${itemId}`).setLabel('Purchase').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('shop_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
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
            // A database read can take longer than Discord's 3-second initial interaction window.
            // Defer immediately so /shop cannot time out while loading economy data.
            await interaction.deferReply();

            let userData = await getFreshUserData();

            const getComponents = () => {
                const rows = [createCategoryMenu(currentCategory), createItemMenu(currentCategory, userData)];
                if (selectedItemId) rows.push(createPurchaseButtons(selectedItemId));
                return rows;
            };

            await interaction.editReply({ embeds: [createShopEmbed(currentCategory, userData)], components: getComponents() });
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
                        await componentInteraction.update({ embeds: [createShopEmbed(currentCategory, userData)], components: getComponents() });
                        return;
                    }

                    if (componentInteraction.customId === 'shop_item') {
                        selectedItemId = componentInteraction.values[0];
                        userData = await getFreshUserData();
                        const item = shopItems.find(shopItem => shopItem.id === selectedItemId);
                        if (!item) {
                            await componentInteraction.reply({ content: '❌ This item no longer exists.', flags: MessageFlags.Ephemeral });
                            return;
                        }

                        const price = getPrice(item, userData);
                        const balance = Number(userData.wallet || 0);
                        const embed = new EmbedBuilder()
                            .setTitle(`${ITEM_EMOJIS[item.id] || '🛍️'} ${getDisplayName(item)}`)
                            .setColor(getColor('primary'))
                            .setDescription(getItemDescription(item))
                            .addFields(
                                { name: 'Price', value: `${SOULS_EMOJI} ${price.toLocaleString()} Souls`, inline: true },
                                { name: 'Balance', value: `${TOTAL_EMOJI} ${balance.toLocaleString()} Souls`, inline: true }
                            );

                        if (item.effect?.type === 'temporary_color_role') {
                            const tierItems = getColorTierItems(item.id);
                            embed.addFields({
                                name: 'Available Durations',
                                value: tierItems.map(tier => `${getDurationText(tier)} — ${SOULS_EMOJI} ${getPrice(tier).toLocaleString()} Souls`).join('\n'),
                                inline: false
                            });
                        }
                        if (item.effect?.type === 'xp_boost') embed.addFields({ name: 'Duration', value: '24 Hours • 2× XP', inline: true });
                        if (item.effect?.type === 'bank_protection') {
                            const bonuses = getCharacterBonuses(userData);
                            embed.addFields({ name: 'Duration', value: `${1 + Number(bonuses.bankProtectionHours || 0)} Hour${1 + Number(bonuses.bankProtectionHours || 0) === 1 ? '' : 's'}`, inline: true });
                        }
                        if (item.effect?.type === 'bank_capacity') embed.addFields({ name: 'Upgrade', value: '+50,000 Bank Capacity', inline: true });

                        embed.addFields({
                            name: 'Status',
                            value: balance < price ? `❌ You need ${SOULS_EMOJI} ${(price - balance).toLocaleString()} more Souls.` : '✅ You can afford this item.',
                            inline: false
                        });

                        await componentInteraction.update({ embeds: [embed], components: getComponents() });
                        return;
                    }

                    if (componentInteraction.customId === 'shop_cancel') {
                        selectedItemId = null;
                        userData = await getFreshUserData();
                        await componentInteraction.update({ embeds: [createShopEmbed(currentCategory, userData)], components: getComponents() });
                        return;
                    }

                    if (!componentInteraction.customId.startsWith('shop_purchase_')) return;

                    const itemId = componentInteraction.customId.replace('shop_purchase_', '');
                    const item = shopItems.find(shopItem => shopItem.id === itemId);
                    if (!item) {
                        await componentInteraction.reply({ content: '❌ This item no longer exists.', flags: MessageFlags.Ephemeral });
                        return;
                    }

                    userData = await getFreshUserData();
                    const price = getPrice(item, userData);
                    const balance = Number(userData.wallet || 0);
                    if (balance < price) {

                    let assignedColorRole = null;
                        await componentInteraction.reply({
                            content: `❌ You don't have enough Souls. You need **${SOULS_EMOJI} ${price.toLocaleString()} Souls** but only have **${TOTAL_EMOJI} ${balance.toLocaleString()} Souls**.`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    if (item.effect?.type === 'temporary_color_role') {
                        if (userData.activeColorRole) {
                            await componentInteraction.reply({ content: '❌ You already have an active temporary color role. Wait until it expires before purchasing another one.', flags: MessageFlags.Ephemeral });
                            return;
                        }

                        const roleName = item.effect?.colorName || getDisplayName(item).replace(/\s*•\s*(7 Days|1 Month|6 Months|1 Year)$/i, '');
                        const role = interaction.guild.roles.cache.find(guildRole => guildRole.name.toLowerCase() === roleName.toLowerCase());
                        if (!role) {
                            await componentInteraction.reply({ content: `❌ The **${roleName}** role was not found in this server.`, flags: MessageFlags.Ephemeral });
                            return;
                        }

                        const member = await interaction.guild.members.fetch(userId);
                        try {
                            await member.roles.add(role, `Purchased ${roleName} color role`);
                            assignedColorRole = role;
                        } catch (roleError) {
                            logger.error('[SHOP] Failed to assign color role:', roleError);
                            await componentInteraction.reply({ content: '❌ I could not give you the role. Your Souls were not deducted.', flags: MessageFlags.Ephemeral });
                            return;
                        }

                        userData.wallet -= price;
                        userData.activeColorRole = {
                            roleId: role.id,
                            roleName: role.name,
                            expiresAt: Date.now() + Number(item.duration || 0)
                        };
                    } else if (item.effect?.type === 'bank_capacity') {
                        userData.wallet -= price;
                        userData.bankLevel = Number(userData.bankLevel || 0) + 1;
                        userData.upgrades = userData.upgrades || {};
                        userData.upgrades.bank_upgrade = userData.bankLevel;
                    } else if (item.effect?.type === 'xp_boost') {
                        userData.wallet -= price;
                        await setXpMultiplier(client, guildId, userId, 2, 24 * 60 * 60 * 1000);
                    } else if (item.effect?.type === 'bank_protection') {
                        const now = Date.now();
                        const bonuses = getCharacterBonuses(userData);
                        const hours = 1 + Number(bonuses.bankProtectionHours || 0);
                        const currentExpiry = Number(userData.bankProtectionExpiresAt || 0);
                        const start = Math.max(now, currentExpiry);
                        userData.wallet -= price;
                        userData.bankProtectionExpiresAt = start + (hours * 60 * 60 * 1000);
                    } else {
                        await componentInteraction.reply({ content: '❌ This item has no valid purchase effect.', flags: MessageFlags.Ephemeral });
                        return;
                    }

                    const saved = await setEconomyData(client, guildId, userId, userData);
                    if (!saved) {
                        if (item.effect?.type === 'temporary_color_role') {
                            const member = await interaction.guild.members.fetch(userId).catch(() => null);
                            if (member && assignedColorRole) {
                                await member.roles.remove(assignedColorRole, 'Rolling back failed shop purchase').catch(() => {});
                            }
                        }
                        await componentInteraction.reply({
                            content: '❌ Your purchase could not be saved safely. No purchase was confirmed. Please try again.',
                            flags: MessageFlags.Ephemeral
                        }).catch(() => {});
                        return;
                    }
                    selectedItemId = null;

                    await componentInteraction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🎉 Purchase Successful')
                                .setColor(getColor('success'))
                                .setDescription(`You purchased **${getDisplayName(item)}**.`)
                                .addFields(
                                    { name: 'Paid', value: `${SOULS_EMOJI} ${price.toLocaleString()} Souls`, inline: true },
                                    { name: 'New Balance', value: `${TOTAL_EMOJI} ${Number(userData.wallet || 0).toLocaleString()} Souls`, inline: true }
                                )
                        ],
                        components: getComponents()
                    });
                } catch (error) {
                    logger.error('[SHOP] Component interaction failed:', error);
                    if (!componentInteraction.replied && !componentInteraction.deferred) {
                        await componentInteraction.reply({ content: '❌ Something went wrong while processing that shop action.', flags: MessageFlags.Ephemeral }).catch(() => {});
                    }
                }
            });
        } catch (error) {
            logger.error('[SHOP] Shop failed:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Something went wrong while opening the shop.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
