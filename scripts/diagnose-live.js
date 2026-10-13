import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import appConfig from '../src/config/application.js';
import { REST, Routes } from 'discord.js';

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
