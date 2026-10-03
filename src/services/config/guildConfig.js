// guildConfig.js — the only module that should read/write guild configuration.

import { GUILD_CONFIG_DEFAULTS } from '../../config/guild/guildConfigDefaults.js';
import { readGuildConfig, writeGuildConfig } from '../../utils/database/guildConfigStorage.js';
import { normalizeGuildConfig, validateGuildConfigOrThrow } from '../../utils/schemas.js';
import { createError, ErrorTypes, wrapServiceBoundary } from '../../utils/errorHandler.js';

export { GUILD_CONFIG_DEFAULTS };

const GUILD_CONFIG_CACHE_TTL_MS = 60000;
const guildConfigCache = new Map();
const guildConfigReadsInFlight = new Map();

function cloneConfig(config) {
    try {
        return structuredClone(config);
    } catch {
        return JSON.parse(JSON.stringify(config));
    }
}

function invalidateGuildConfigCache(guildId) {
    guildConfigCache.delete(guildId);
}

export const getGuildConfig = wrapServiceBoundary(async function getGuildConfig(client, guildId, context = {}) {
    const cached = guildConfigCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) {
        return cloneConfig(cached.config);
    }

    const inFlight = guildConfigReadsInFlight.get(guildId);
    if (inFlight) {
        return cloneConfig(await inFlight);
    }

    const readPromise = readGuildConfig(client, guildId, context)
        .then((config) => normalizeGuildConfig(config, GUILD_CONFIG_DEFAULTS))
        .then((config) => {
            guildConfigCache.set(guildId, {
                config: cloneConfig(config),
                expiresAt: Date.now() + GUILD_CONFIG_CACHE_TTL_MS,
            });
            return config;
        })
        .finally(() => {
            guildConfigReadsInFlight.delete(guildId);
        });

    guildConfigReadsInFlight.set(guildId, readPromise);
    return cloneConfig(await readPromise);
}, {
    service: 'guildConfigService',
    operation: 'getGuildConfig',
    message: 'Failed to fetch guild configuration',
    userMessage: 'Failed to load server configuration. Please try again.',
});

export const setGuildConfig = wrapServiceBoundary(async function setGuildConfig(client, guildId, config, context = {}) {
    const normalized = normalizeGuildConfig(config, GUILD_CONFIG_DEFAULTS);
    const saved = await writeGuildConfig(client, guildId, normalized, context);
    invalidateGuildConfigCache(guildId);
    return saved;
}, {
    service: 'guildConfigService',
    operation: 'setGuildConfig',
    message: 'Failed to save guild configuration',
    userMessage: 'Failed to save server configuration. Please try again.',
});

export const updateGuildConfig = wrapServiceBoundary(async function updateGuildConfig(client, guildId, updates, context = {}) {
    const currentConfig = await readGuildConfig(client, guildId, context);
    const merged = { ...currentConfig, ...updates };
    const normalized = normalizeGuildConfig(merged, GUILD_CONFIG_DEFAULTS);
    const saved = await writeGuildConfig(client, guildId, normalized, context);
    invalidateGuildConfigCache(guildId);
    return saved;
}, {
    service: 'guildConfigService',
    operation: 'updateGuildConfig',
    message: 'Failed to update guild configuration',
    userMessage: 'Failed to update server configuration. Please try again.',
});

export const getConfigValue = wrapServiceBoundary(async function getConfigValue(client, guildId, key, defaultValue = null, context = {}) {
    const config = await getGuildConfig(client, guildId, context);
    return config[key] !== undefined ? config[key] : defaultValue;
}, {
    service: 'guildConfigService',
    operation: 'getConfigValue',
    message: 'Failed to read guild configuration value',
    userMessage: 'Failed to read a server setting. Please try again.',
});

export const setConfigValue = wrapServiceBoundary(async function setConfigValue(client, guildId, key, value, context = {}) {
    return await updateGuildConfig(client, guildId, { [key]: value }, context);
}, {
    service: 'guildConfigService',
    operation: 'setConfigValue',
    message: 'Failed to update guild configuration value',
    userMessage: 'Failed to update a server setting. Please try again.',
});

/**
 * Merge partial updates into a nested config object (e.g. verification, logging).
 */
export const patchGuildConfig = wrapServiceBoundary(async function patchGuildConfig(client, guildId, patch, context = {}) {
    if (!patch || typeof patch !== 'object') {
        throw createError(
            'Invalid guild config patch',
            ErrorTypes.VALIDATION,
            'Invalid configuration update.',
            { guildId, ...context },
        );
    }

    const currentConfig = await readGuildConfig(client, guildId, context);
    const merged = deepMergeGuildConfig(currentConfig, patch);
    const normalized = normalizeGuildConfig(merged, GUILD_CONFIG_DEFAULTS);
    validateGuildConfigOrThrow(normalized, { guildId, ...context });
    const saved = await writeGuildConfig(client, guildId, normalized, context);
    invalidateGuildConfigCache(guildId);
    return saved;
}, {
    service: 'guildConfigService',
    operation: 'patchGuildConfig',
    message: 'Failed to patch guild configuration',
    userMessage: 'Failed to update server configuration. Please try again.',
});

function deepMergeGuildConfig(base, patch) {
    const result = { ...base };

    for (const [key, value] of Object.entries(patch)) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            base[key] &&
            typeof base[key] === 'object' &&
            !Array.isArray(base[key])
        ) {
            result[key] = { ...base[key], ...value };
        } else {
            result[key] = value;
        }
    }

    return result;
}
