import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import appConfig from '../src/config/application.js';
import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';

const token = appConfig.bot.token;
const clientId = appConfig.bot.clientId;

console.log('[DIAG] start: Niko live command registration');
console.log(`[DIAG] clientIdConfigured=${Boolean(clientId)} tokenConfigured=${Boolean(token)}`);

if (token && clientId) {
    try {
        const rest = new REST({ version: '10' }).setToken(token);
        const [botUser, commands] = await Promise.all([
            rest.get(Routes.user('@me')),
            rest.get(Routes.applicationCommands(clientId)),
        ]);
        console.log(`[DIAG] authenticatedBotId=${botUser.id} username=${botUser.username}`);
        console.log(`[DIAG] globalCommandCount=${commands.length}`);

        const namesToCheck = [
            'help', 'ping', 'games', 'shop', 'quickcoin', 'daily',
            'balance', 'fight', 'buy', 'inventory', 'economy',
            'leaderboard', 'level', 'rank', 'verify', 'welcome', 'greet',
        ];
        for (const name of namesToCheck) {
            const command = commands.find((item) => item.name === name);
            if (!command) {
                console.log(`[DIAG] command ${name}: MISSING_FROM_GLOBAL_REGISTRY`);
                continue;
            }
            const permissions = command.default_member_permissions;
            console.log(`[DIAG] command ${name}: default_member_permissions=${permissions === undefined ? 'UNSET/PUBLIC' : permissions === null ? 'PUBLIC' : permissions}`);
        }

        const restricted = commands
            .filter((command) => command.default_member_permissions !== undefined &&
                command.default_member_permissions !== null)
            .map((command) => `${command.name}=${command.default_member_permissions}`);
        console.log(`[DIAG] commandsWithDefaultRestrictions=${restricted.length}`);
        console.log(`[DIAG] restrictedNames=${restricted.join(', ') || '(none)'}`);
    } catch (error) {
        console.error(`[DIAG] Discord API check failed: status=${error.status || 'unknown'} code=${error.code || 'unknown'} message=${String(error.message || error).slice(0, 300)}`);
        process.exitCode = 1;
    }
} else {
    console.error('[DIAG] Cannot query Discord because CLIENT_ID or DISCORD_TOKEN/TOKEN is missing in D:\\Niko environment.');
    process.exitCode = 1;
}

// Compare the commands produced by the checked-out source with the live API.
if (token) {
    try {
        const { loadCommands } = await import('../src/handlers/loaders/commandLoader.js');
        const sourceClient = {};
        await loadCommands(sourceClient);
        for (const name of ['games', 'shop', 'quickcoin', 'daily', 'balance', 'fight', 'buy', 'inventory', 'todo', 'count', 'economy', 'level', 'verify']) {
            const command = sourceClient.commands.get(name);
            if (!command) {
                console.log(`[DIAG] localSourceCommand ${name}=MISSING`);
                continue;
            }
            const perms = command.data.toJSON().default_member_permissions;
            console.log(`[DIAG] localSourceCommand ${name}=${perms === undefined ? 'UNSET/PUBLIC' : perms === null ? 'PUBLIC' : perms}`);
        }
    } catch (error) {
        console.error(`[DIAG] Local command build failed: ${String(error.message || error).slice(0, 250)}`);
    }
}

// This one-run probe uses the authorized runner's bot token to inspect actual
// guilds/channels and try reading per-guild command overrides. It is enabled
// only by NIKO_DIAG_GUILDS=1 in the deployment workflow.
if (token && clientId && process.env.NIKO_DIAG_GUILDS === '1') {
    const gateway = new Client({ intents: [GatewayIntentBits.Guilds] });
    let readyTimer;
    try {
        const ready = new Promise((resolve, reject) => {
            gateway.once(Events.ClientReady, resolve);
            gateway.once('error', reject);
            readyTimer = setTimeout(() => reject(new Error('Gateway ready timeout')), 20000);
        });
        await gateway.login(token);
        await ready;
        clearTimeout(readyTimer);
        const targetNames = new Set(['help', 'ping', 'games', 'shop', 'quickcoin', 'daily', 'balance', 'fight', 'buy', 'inventory', 'todo', 'verify']);
        const commandNamesById = new Map();
        try {
            const globalCommands = await new REST({ version: '10' }).setToken(token).get(Routes.applicationCommands(clientId));
            for (const command of globalCommands) commandNamesById.set(command.id, command.name);
        } catch {}

        for (const guild of gateway.guilds.cache.values()) {
            const systemChannel = guild.systemChannel || null;
            console.log(`[DIAG] guild id=${guild.id} name=${guild.name} memberCount=${guild.memberCount} systemChannel=${systemChannel?.name || '(none)'} systemChannelId=${guild.systemChannelId || '(none)'}`);
            const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
            const matchingChannels = [...guild.channels.cache.values()].filter((channel) => {
                if (!channel?.isTextBased?.()) return false;
                const name = String(channel.name || '').normalize('NFKD').toLowerCase();
                return /welcome|new.?member|arrival|greet|general|chat|rules|lobby|start|announc/.test(name);
            });
            for (const channel of matchingChannels) {
                const perms = botMember ? channel.permissionsFor(botMember) : null;
                console.log(`[DIAG] candidateChannel guild=${guild.id} name=${channel.name} id=${channel.id} canView=${Boolean(perms?.has('ViewChannel'))} canSend=${Boolean(perms?.has('SendMessages'))}`);
            }
            const likelyRoles = [...guild.roles.cache.values()].filter((role) => role.id !== guild.id && /member|verified|guest|new user|community/i.test(role.name));
            console.log(`[DIAG] likelyMemberRoles guild=${guild.id} ${likelyRoles.map((role) => `${role.name}:${role.id}`).join(', ') || '(none found by name)'}`);

            try {
                const overrides = await new REST({ version: '10' }).setToken(token)
                    .get(`/applications/${clientId}/guilds/${guild.id}/commands/permissions`);
                const entries = Array.isArray(overrides) ? overrides : (overrides?.permissions || []);
                let shown = 0;
                for (const entry of entries) {
                    const name = commandNamesById.get(entry.id);
                    if (!targetNames.has(name)) continue;
                    const permissions = (entry.permissions || []).map((item) => `${item.type}:${item.id}=${item.permission}`).join(',');
                    if (permissions) {
                        console.log(`[DIAG] guildCommandOverride guild=${guild.id} command=${name} ${permissions}`);
                        shown++;
                    }
                }
                console.log(`[DIAG] guildCommandOverrides guild=${guild.id} targetedOverrides=${shown}`);
            } catch (error) {
                console.log(`[DIAG] guildCommandOverrides guild=${guild.id} unavailable status=${error.status || 'unknown'} message=${String(error.message || error).slice(0, 180)}`);
            }
        }
    } catch (error) {
        console.error(`[DIAG] Guild/channel probe failed: ${String(error.message || error).slice(0, 250)}`);
    } finally {
        if (readyTimer) clearTimeout(readyTimer);
        gateway.destroy();
    }
}

const pm2Home = process.env.PM2_HOME || 'C:\\ProgramData\\pm2\\home';
const logDir = path.join(pm2Home, 'logs');
const safePatterns = [
    /Logged in as /i,
    /\[Ready\] Niko is connected to/i,
    /Successfully registered \d+ global commands/i,
    /Registering \d+ global commands/i,
    /Registered event: guildMemberAdd/i,
    /\[Welcome\] Member join received/i,
    /\[Welcome\] Message not sent/i,
    /\[Welcome\] Could not load/i,
    /\[Welcome\] Could not fetch/i,
    /Error executing event guildMemberAdd/i,
    /Error in guildMemberAdd event/i,
    /Failed to start bot/i,
    /Error registering commands/i,
];
try {
    const logFiles = fs.existsSync(logDir)
        ? fs.readdirSync(logDir).filter((name) => /^niko.*(?:out|error)\.log$/i.test(name))
        : [];
    for (const file of logFiles) {
        const fullPath = path.join(logDir, file);
        const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
        const matched = lines.filter((line) => safePatterns.some((pattern) => pattern.test(line))).slice(-80);
        console.log(`[DIAG] filteredRuntimeLog=${file} matches=${matched.length}`);
        for (const line of matched) {
            const safeLine = line
                .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]')
                .slice(0, 700);
            console.log(`[LOG] ${safeLine}`);
        }
    }
    if (logFiles.length === 0) console.log(`[DIAG] No Niko PM2 log files found under ${logDir}`);
} catch (error) {
    console.error(`[DIAG] Could not read PM2 logs: ${String(error.message || error).slice(0, 200)}`);
}
console.log('[DIAG] end');
