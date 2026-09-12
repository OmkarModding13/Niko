import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';

import { shopItems } from '../../../config/shop/items.js';
import { getColor } from '../../../config/bot.js';
import { getEconomyData } from '../../../utils/economy.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

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
        description: 'Permanent upgrades for your economy.',
        types: ['upgrade']
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
    bank_upgrade: '🏦'
};

function getItemsForCategory(categoryId) {
    const category = CATEGORIES[categoryId];

    if (!category) {
        return [];
    }

    return shopItems.filter(item =>
        category.types.includes(item.type)
    );
}

function getDisplayName(item) {
    const emoji = ITEM_EMOJIS[item.id] || '';

    let name = item.name || item.id;

    // Remove any existing emoji from the beginning
    name = name
        .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '')
        .trim();

    return name;
}

function getPrice(item, userData = null) {
    if (item.effect?.type === 'temporary_color_role') {
        return 350;
    }

    if (item.effect?.type === 'bank_capacity') {
        const bankLevel =
            Number(userData?.bankLevel || 0);

        return 3000 + (bankLevel * 1000);
    }

    return item.price || 0;
}

function getItemDescription(item) {
    if (item.effect?.type === 'temporary_color_role') {
        return 'Temporary color role for 7 days.';
    }

    if (item.effect?.type === 'bank_capacity') {
        return 'Increase your bank capacity by 50,000 Souls.';
    }

    return item.description || '';
}

function createShopEmbed(categoryId, userData) {
    const category = CATEGORIES[categoryId];
    const items = getItemsForCategory(categoryId);

    const embed = new EmbedBuilder()
        .setTitle('🛒 Hollow Devil Shop')
        .setColor(getColor('primary'))
        .setDescription(
            'Spend your Souls on exclusive rewards!'
        );

    embed.addFields({
        name: `${category.emoji} ${category.name}`,
        value: category.description,
        inline: false
    });

    for (const item of items) {
        const emoji =
            ITEM_EMOJIS[item.id] || '🛍️';

        const displayName =
            getDisplayName(item);

        const price =
            getPrice(item, userData);

        let description =
            getItemDescription(item);

        if (
            item.effect?.type ===
            'temporary_color_role'
        ) {
            description +=
                '\n⏳ Duration: **7 Days**';
        }

        if (
            item.effect?.type ===
            'bank_capacity'
        ) {
            description +=
                '\n📈 Increase: **+50,000 Bank Capacity**';
        }

        embed.addFields({
            name:
                `${emoji} ${displayName} — ${SOULS_EMOJI} ${price.toLocaleString()}`,
            value: description,
            inline: false
        });
    }

    embed.addFields({
        name: '💰 Your Balance',
        value:
            `${TOTAL_EMOJI} ${(userData?.wallet || 0).toLocaleString()} Souls`,
        inline: false
    });

    embed.setFooter({
        text:
            'Select a category, then select an item to purchase.'
    });

    return embed;
}

function createCategoryMenu(selectedCategory) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('shop_category')
            .setPlaceholder('Select a category...')
            .addOptions(
                Object.entries(CATEGORIES).map(
                    ([id, category]) => ({
                        label: category.name,
                        value: id,
                        description:
                            category.description.substring(
                                0,
                                100
                            ),
                        emoji: category.emoji,
                        default:
                            id === selectedCategory
                    })
                )
            )
    );
}

function createItemMenu(categoryId) {
    const items =
        getItemsForCategory(categoryId);

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            // IMPORTANT:
            // No ":" here.
            // This allows interactionCreate.js to ignore
            // this collector-managed component.
            .setCustomId('shop_item')
            .setPlaceholder('Select an item to purchase...')
            .addOptions(
                items.map(item => ({
                    label:
                        getDisplayName(item),

                    value:
                        item.id,

                    description:
                        `${getPrice(item).toLocaleString()} Souls`,

                    emoji:
                        ITEM_EMOJIS[item.id] || '🛍️'
                }))
            )
    );
}

export default {
    async execute(
        interaction,
        config,
        client
    ) {
        try {
            const userId =
                interaction.user.id;

            const guildId =
                interaction.guildId;

            let currentCategory =
                'color_roles';

            const getFreshUserData =
                async () =>
                    await getEconomyData(
                        client,
                        guildId,
                        userId
                    );

            let userData =
                await getFreshUserData();

            const getComponents = () => [
                createCategoryMenu(
                    currentCategory
                ),
                createItemMenu(
                    currentCategory
                )
            ];

            await interaction.reply({
                embeds: [
                    createShopEmbed(
                        currentCategory,
                        userData
                    )
                ],
                components:
                    getComponents(),

                flags:
                    MessageFlags.Ephemeral
            });

            const message =
                await interaction.fetchReply();

            const collector =
                message.createMessageComponentCollector({
                    time: 300000
                });

            collector.on(
                'collect',
                async componentInteraction => {
                    try {
                        if (
                            componentInteraction.user.id !==
                            userId
                        ) {
                            await componentInteraction.reply({
                                content:
                                    '❌ This shop belongs to someone else. Use `/shop` to open your own shop.',
                                flags:
                                    MessageFlags.Ephemeral
                            });

                            return;
                        }

                        /*
                         * CATEGORY
                         */
                        if (
                            componentInteraction.customId ===
                            'shop_category'
                        ) {
                            currentCategory =
                                componentInteraction.values[0];

                            userData =
                                await getFreshUserData();

                            await componentInteraction.update({
                                embeds: [
                                    createShopEmbed(
                                        currentCategory,
                                        userData
                                    )
                                ],
                                components:
                                    getComponents()
                            });

                            return;
                        }

                        /*
                         * ITEM
                         */
                        if (
                            componentInteraction.customId ===
                            'shop_item'
                        ) {
                            const itemId =
                                componentInteraction.values[0];

                            const item =
                                shopItems.find(
                                    shopItem =>
                                        shopItem.id ===
                                        itemId
                                );

                            if (!item) {
                                await componentInteraction.reply({
                                    content:
                                        '❌ This item no longer exists.',
                                    flags:
                                        MessageFlags.Ephemeral
                                });

                                return;
                            }

                            const freshUserData =
                                await getFreshUserData();

                            const price =
                                getPrice(
                                    item,
                                    freshUserData
                                );

                            const balance =
                                freshUserData?.wallet || 0;

                            const displayName =
                                getDisplayName(item);

                            const emoji =
                                ITEM_EMOJIS[item.id] ||
                                '🛍️';

                            const canAfford =
                                balance >= price;

                            let content =
                                `### ${emoji} ${displayName}\n\n`;

                            content +=
                                `${getItemDescription(item)}\n\n`;

                            content +=
                                `**Price:** ${SOULS_EMOJI} ${price.toLocaleString()} Souls\n`;

                            content +=
                                `**Your Balance:** ${TOTAL_EMOJI} ${balance.toLocaleString()} Souls`;

                            if (
                                item.effect?.type ===
                                'temporary_color_role'
                            ) {
                                content +=
                                    '\n**Duration:** 7 Days';
                            }

                            if (
                                item.effect?.type ===
                                'bank_capacity'
                            ) {
                                content +=
                                    '\n**Increase:** +50,000 Bank Capacity';

                                content +=
                                    `\n**Current Upgrade Level:** ${freshUserData?.bankLevel || 0}`;
                            }

                            if (!canAfford) {
                                const needed =
                                    price - balance;

                                content +=
                                    `\n\n❌ You need **${SOULS_EMOJI} ${needed.toLocaleString()}** more Souls.`;
                            } else {
                                content +=
                                    `\n\n✅ You can afford this item.`;

                                content +=
                                    `\nUse **/buy item_id:${item.id}** to purchase it.`;
                            }

                            await componentInteraction.reply({
                                content,
                                flags:
                                    MessageFlags.Ephemeral
                            });

                            return;
                        }

                    } catch (error) {
                        logger.error(
                            'Shop component interaction error:',
                            error
                        );
                    }
                }
            );

            collector.on(
                'end',
                async () => {
                    try {
                        const disabledRows =
                            getComponents();

                        for (
                            const row of disabledRows
                        ) {
                            for (
                                const component
                                of row.components
                            ) {
                                component.setDisabled(
                                    true
                                );
                            }
                        }

                        await message.edit({
                            components:
                                disabledRows
                        });

                    } catch (error) {
                        logger.debug(
                            'shop_browse: could not disable components',
                            {
                                error:
                                    error.message
                            }
                        );
                    }
                }
            );

        } catch (error) {
            await handleInteractionError(
                interaction,
                error,
                {
                    command:
                        'shop_browse'
                }
            );
        }
    }
};
