import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { shopItems } from '../../config/shop/items.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { setXpMultiplier } from '../../services/leveling/leveling.js';
import { getCharacterBonuses } from '../../services/gacha/characters.js';
import {
    withErrorHandling,
    createError,
    ErrorTypes
} from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SHOP_ITEMS = shopItems;
const CURRENCY_EMOJI = '<:Souls:1547510037621112894>';

const COLOR_ROLE_NAMES = {
    red: 'Red', pink: 'Pink', purple: 'Purple', cyan: 'Cyan',
    black: 'Black', lime: 'Lime', yellow: 'Yellow'
};

function getColorRoleName(itemId) {
    const match = itemId.match(/^color_(red|pink|purple|cyan|black|lime|yellow)_/);
    return match ? COLOR_ROLE_NAMES[match[1]] : null;
}

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption(option => option.setName('item_id').setDescription('ID of the item to buy').setRequired(true))
        .addIntegerOption(option => option.setName('quantity').setDescription('Quantity to buy (default: 1)').setRequired(false).setMinValue(1).setMaxValue(10)),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const itemId = interaction.options.getString('item_id').toLowerCase().trim();
        const quantity = interaction.options.getInteger('quantity') || 1;
        const item = SHOP_ITEMS.find(shopItem => shopItem.id === itemId);

        if (!item) {
            throw createError(`Item ${itemId} not found`, ErrorTypes.VALIDATION, `The item ID \`${itemId}\` does not exist in the shop.`, { itemId });
        }
        if (quantity < 1) {
            throw createError('Invalid quantity', ErrorTypes.VALIDATION, 'You must purchase at least 1 item.', { quantity });
        }

        const userData = await getEconomyData(client, guildId, userId);
        if (!userData) {
            throw createError('Economy data unavailable', ErrorTypes.DATABASE, 'Your economy data could not be loaded. Please try again.');
        }

        // COLOR ROLE
        if (item.effect?.type === 'temporary_color_role') {
            if (quantity !== 1) throw createError('Invalid quantity', ErrorTypes.VALIDATION, 'You can only purchase one color role at a time.');

            const price = Number(item.price || 0);
            if (userData.wallet < price) throw createError('Insufficient funds', ErrorTypes.VALIDATION, `You need **${CURRENCY_EMOJI} ${price.toLocaleString()}** to buy **${item.name}**, but you only have **${CURRENCY_EMOJI} ${userData.wallet.toLocaleString()}**.`);

            const roleName = getColorRoleName(itemId);
            if (!roleName) throw createError('Color role configuration error', ErrorTypes.CONFIGURATION, 'This color role is not configured correctly.');

            const role = interaction.guild.roles.cache.find(guildRole => guildRole.name === roleName);
            if (!role) throw createError('Role not found', ErrorTypes.CONFIGURATION, `The **${roleName}** role does not exist in this server.`);

            const previousRoleId = userData.activeColorRole?.roleId || null;
            if (previousRoleId && previousRoleId !== role.id) {
                const previousRole = interaction.guild.roles.cache.get(previousRoleId);
                if (previousRole) {
                    try { await interaction.member.roles.remove(previousRole, 'Replacing temporary shop color role'); } catch {}
                }
            }

            if (interaction.member.roles.cache.has(role.id)) {
                throw createError('Role already active', ErrorTypes.VALIDATION, `You already have the **${roleName}** color role active.`);
            }

            try {
                await interaction.member.roles.add(role, `Purchased temporary color role: ${roleName}`);
            } catch (roleError) {
                throw createError('Role assignment failed', ErrorTypes.DISCORD_API, `I couldn't give you the **${roleName}** role. Your Souls were not deducted.`, { roleId: role.id, originalError: roleError.message });
            }

            userData.wallet -= price;
            userData.activeColorRole = { roleId: role.id, roleName, expiresAt: Date.now() + item.duration };
            await setEconomyData(client, guildId, userId, userData);

            const embed = successEmbed('🎨 Color Role Purchased', `You purchased the **${roleName}** color role for **${CURRENCY_EMOJI} ${price.toLocaleString()}**.`)
                .addFields(
                    { name: 'Duration', value: item.description.replace(/^Temporary .* color role for /, '').replace(/\.$/, ''), inline: true },
                    { name: 'Expires', value: `<t:${Math.floor(userData.activeColorRole.expiresAt / 1000)}:R>`, inline: true },
                    { name: 'New Balance', value: `${CURRENCY_EMOJI} ${userData.wallet.toLocaleString()}`, inline: true }
                );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
            return;
        }

        // BANK CAPACITY UPGRADE
        if (item.effect?.type === 'bank_capacity') {
            if (quantity !== 1) throw createError('Invalid quantity', ErrorTypes.VALIDATION, 'Bank Capacity Upgrade can only be purchased one level at a time.');

            const currentBankLevel = Number(userData.bankLevel || 0);
            const price = 3000 + (currentBankLevel * 1000);

            if (userData.wallet < price) {
                throw createError('Insufficient funds', ErrorTypes.VALIDATION, `You need **${CURRENCY_EMOJI} ${price.toLocaleString()}** for your next bank upgrade, but you only have **${CURRENCY_EMOJI} ${userData.wallet.toLocaleString()}**.`);
            }

            userData.wallet -= price;
            userData.bankLevel = currentBankLevel + 1;
            userData.upgrades = userData.upgrades || {};
            userData.upgrades.bank_upgrade = userData.bankLevel;
            await setEconomyData(client, guildId, userId, userData);

            const newCapacity = 100000 + (userData.bankLevel * 50000);
            const embed = successEmbed('🏦 Bank Upgrade Purchased', 'Your bank capacity has been increased by **50,000 Souls**!')
                .addFields(
                    { name: 'Upgrade Cost', value: `${CURRENCY_EMOJI} ${price.toLocaleString()}`, inline: true },
                    { name: 'New Capacity', value: `${CURRENCY_EMOJI} ${newCapacity.toLocaleString()}`, inline: true },
                    { name: 'Upgrade Level', value: `${userData.bankLevel}`, inline: true },
                    { name: 'New Balance', value: `${CURRENCY_EMOJI} ${userData.wallet.toLocaleString()}`, inline: true },
                    { name: 'Next Upgrade', value: `${CURRENCY_EMOJI} ${(3000 + (userData.bankLevel * 1000)).toLocaleString()}`, inline: true }
                );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
            return;
        }

        // XP BOOSTER
        if (item.effect?.type === 'xp_boost') {
            if (quantity !== 1) throw createError('Invalid quantity', ErrorTypes.VALIDATION, 'You can only purchase one XP Booster at a time.');
            const price = 3000;

            if (userData.wallet < price) {
                throw createError('Insufficient funds', ErrorTypes.VALIDATION, `You need **${CURRENCY_EMOJI} ${price.toLocaleString()}** for the XP Booster, but you only have **${CURRENCY_EMOJI} ${userData.wallet.toLocaleString()}**.`);
            }

            await setXpMultiplier(client, guildId, userId, 2, 24 * 60 * 60 * 1000);
            userData.wallet -= price;
            await setEconomyData(client, guildId, userId, userData);

            const embed = successEmbed('⚡ XP Booster Purchased', `You activated **2× XP** for **24 hours** for **${CURRENCY_EMOJI} ${price.toLocaleString()}**.`)
                .addFields({ name: 'New Balance', value: `${CURRENCY_EMOJI} ${userData.wallet.toLocaleString()}`, inline: true });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
            return;
        }

        // BANK PROTECTION
        if (item.effect?.type === 'bank_protection') {
            if (quantity !== 1) throw createError('Invalid quantity', ErrorTypes.VALIDATION, 'You can only purchase one Bank Protection at a time.');
            const price = 3000;

            if (userData.wallet < price) {
                throw createError('Insufficient funds', ErrorTypes.VALIDATION, `You need **${CURRENCY_EMOJI} ${price.toLocaleString()}** for Bank Protection, but you only have **${CURRENCY_EMOJI} ${userData.wallet.toLocaleString()}**.`);
            }

            const bonuses = getCharacterBonuses(userData);
            const hours = 1 + Number(bonuses.bankProtectionHours || 0);
            const now = Date.now();
            const currentExpiry = Number(userData.bankProtectionExpiresAt || 0);
            const start = Math.max(now, currentExpiry);

            userData.wallet -= price;
            userData.bankProtectionExpiresAt = start + (hours * 60 * 60 * 1000);
            await setEconomyData(client, guildId, userId, userData);

            const embed = successEmbed('🛡️ Bank Protection Purchased', `Your wallet is protected from Bank Robbery for **${hours} hours**.`)
                .addFields(
                    { name: 'Cost', value: `${CURRENCY_EMOJI} ${price.toLocaleString()}`, inline: true },
                    { name: 'Expires', value: `<t:${Math.floor(userData.bankProtectionExpiresAt / 1000)}:R>`, inline: true },
                    { name: 'New Balance', value: `${CURRENCY_EMOJI} ${userData.wallet.toLocaleString()}`, inline: true }
                );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
            return;
        }

        throw createError('Unsupported item', ErrorTypes.CONFIGURATION, `The item **${item.name}** is not supported by the current shop system.`, { itemId });
    }, { command: 'buy' })
};
