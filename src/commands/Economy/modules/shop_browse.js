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

const CURRENCY_EMOJI = '<:Souls:1547510037621112894>';

const CATEGORIES = {
    color_roles: {
        name: '🎨 Color Roles',
        description: 'Temporary color roles for 7 days.',
        types: ['role']
    },

    upgrades: {
        name: '🏦 Upgrades',
        description: 'Permanent upgrades for your economy.',
        types: ['upgrade']
    }
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

function getCategoryIdForItem(item) {
    if (item.effect?.type === 'temporary_color_role') {
        return 'color_roles';
    }

    if (item.effect?.type === 'bank_capacity') {
        return 'upgrades';
    }

    return null;
}

function getDisplayPrice(item) {
    if (item.effect?.type === 'temporary_color_role') {
        return 350;
    }

    if (item.effect?.type === 'bank_capacity') {
        return 3000;
    }

    return item.price || 0;
}

function createMainEmbed(categoryId, userData) {
    const category = CATEGORIES[categoryId];
    const items = getItemsForCategory(categoryId);

    const embed = new EmbedBuilder()
        .setTitle(`🛒 Hollow Devil Shop`)
        .setColor(getColor('primary'))
        .setDescription(
            `Spend your **Souls** on exclusive rewards!\n\n` +
            `### ${category.name}\n` +
            `${category.description}`
        );

    for (const item of items) {
        const price = getDisplayPrice(item);

        let extraInfo = '';

        if (item.effect?.type === 'temporary_color_role') {
            extraInfo = ' • 7 Days';
        }

        if (item.effect?.type === 'bank_capacity') {
            extraInfo = ' • +50,000 Capacity';
        }

        embed.addFields({
            name: `${item.name} — ${CURRENCY_EMOJI} ${price.toLocaleString()}`,
            value: `${item.description}${extraInfo}`,
            inline: false
        });
    }

    embed.addFields({
        name: '💰 Your Balance',
        value: `${CURRENCY_EMOJI} ${(userData?.wallet || 0).toLocaleString()} Souls`,
        inline: false
    });

    embed.setFooter({
        text: 'Select a category and item below to purchase.'
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
                        label: category.name.replace(/^.\s/, ''),
                        value: id,
                        description: category.description,
                        emoji: category.name.split(' ')[0],
                        default: id === selectedCategory
                    })
                )
            )
    );
}

function createItemMenu(categoryId) {
    const items = getItemsForCategory(categoryId);

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`shop_item:${categoryId}`)
            .setPlaceholder('Select an item to purchase...')
            .addOptions(
                items.map(item => ({
                    label: item.name.replace(/^.\s/, ''),
                    value: item.id,
                    description:
                        `${getDisplayPrice(item).toLocaleString()} Souls`,
                    emoji: item.name.split(' ')[0]
                }))
            )
    );
}

export default {
    async execute(interaction, config, client) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            const userData = await getEconomyData(
                client,
                guildId,
                userId
            );

            let currentCategory = 'color_roles';

            const getComponents = () => [
                createCategoryMenu(currentCategory),
                createItemMenu(currentCategory)
            ];

            await interaction.reply({
                embeds: [
                    createMainEmbed(
                        currentCategory,
                        userData
                    )
                ],
                components: getComponents(),
                flags: MessageFlags.Ephemeral
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
                                    '❌ This shop belongs to someone else. Use `/shop` to open your own.',
                                flags: MessageFlags.Ephemeral
                            });

                            return;
                        }

                        /*
                         * CATEGORY SELECT
                         */
                        if (
                            componentInteraction.customId ===
                            'shop_category'
                        ) {
                            currentCategory =
                                componentInteraction.values[0];

                            const freshUserData =
                                await getEconomyData(
                                    client,
                                    guildId,
                                    userId
                                );

                            await componentInteraction.update({
                                embeds: [
                                    createMainEmbed(
                                        currentCategory,
                                        freshUserData
                                    )
                                ],
                                components:
                                    getComponents()
                            });

                            return;
                        }

                        /*
                         * ITEM SELECT
                         */
                        if (
                            componentInteraction.customId.startsWith(
                                'shop_item:'
                            )
                        ) {
                            const itemId =
                                componentInteraction.values[0];

                            const item =
                                shopItems.find(
                                    shopItem =>
                                        shopItem.id === itemId
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

                            const price =
                                getDisplayPrice(item);

                            const freshUserData =
                                await getEconomyData(
                                    client,
                                    guildId,
                                    userId
                                );

                            const canAfford =
                                (freshUserData?.wallet || 0) >=
                                price;

                            let messageText =
                                `### ${item.name}\n\n` +
                                `${item.description}\n\n` +
                                `**Price:** ${CURRENCY_EMOJI} ${price.toLocaleString()} Souls\n` +
                                `**Your Balance:** ${CURRENCY_EMOJI} ${(freshUserData?.wallet || 0).toLocaleString()} Souls`;

                            if (
                                item.effect?.type ===
                                'temporary_color_role'
                            ) {
                                messageText +=
                                    '\n**Duration:** 7 Days';
                            }

                            if (
                                item.effect?.type ===
                                'bank_capacity'
                            ) {
                                messageText +=
                                    '\n**Upgrade:** +50,000 Bank Capacity';
                            }

                            if (!canAfford) {
                                messageText +=
                                    `\n\n❌ You need **${CURRENCY_EMOJI} ${(price - (freshUserData?.wallet || 0)).toLocaleString()}** more Souls.`;
                            } else {
                                messageText +=
                                    `\n\nUse **/buy item_id:${item.id}** to purchase this item.`;
                            }

                            await componentInteraction.reply({
                                content: messageText,
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

            collector.on('end', async () => {
                try {
                    const disabledRows =
                        getComponents();

                    for (const row of disabledRows) {
                        for (
                            const component
                            of row.components
                        ) {
                            component.setDisabled(true);
                        }
                    }

                    await message.edit({
                        components: disabledRows
                    });

                } catch (error) {
                    logger.debug(
                        'shop_browse: could not disable components',
                        {
                            error: error.message
                        }
                    );
                }
            });

        } catch (error) {
            await handleInteractionError(
                interaction,
                error,
                {
                    command: 'shop_browse'
                }
            );
        }
    }
};
