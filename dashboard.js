// lang: JavaScript, file: public/dashboard.js, target: Browser
// reemplaza socket.io con polling cada 500ms a /api/logs

let activeTab         = 'bot';
let selectedBotGuild  = null;
let selectedSelfGuild = null;
let lastLogTime       = Date.now();
let pollInterval      = null;

const BOT_PRESETS = {
    fullNuke:    ['deleteWebhooks','creatorNuke','dmAll','deleteChannels','deleteRoles','spamChannels','spamRoles','massBan','renameServer','changeIcon'],
    creatorNuke: ['deleteWebhooks','creatorNuke','massBan','deleteChannels'],
    chaosMode:   ['spamChannels','spamRoles','renameAll','renameServer','dmAll','massBan'],
    stealth:     ['massBan','deleteWebhooks','deleteRoles'],
    purgeOnly:   ['massBan','massKick'],
    spamOnly:    ['spamChannels','spamRoles','dmAll'],
};
const SELF_PRESETS = {
    fullRageNuke: ['fullRageNuke'],
    ghostNuke:    ['ghostNuke'],
    floodMode:    ['floodMode'],
    rageQuit:     ['rageQuit'],
    adminNuke:    ['adminNuke'],
    dmBombAll:    ['massDMAll'],
};

// ── helpers ───────────────────────────────────────────────────────────────────
const $   = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const api = (url, body) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
}).then(r => r.json()).catch(e => ({ ok: false, error: e.message }));

// ── log polling ───────────────────────────────────────────────────────────────
function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/logs?since=${lastLogTime}`);
            const { logs } = await res.json();
            if (logs?.length) {
                logs.forEach(l => {
                    appendLog(l.type, l.msg);
                    if (l.time >= lastLogTime) lastLogTime = l.time + 1;
                });
            }
        } catch (_) {}
    }, 500);
}

function appendLog(type, msg) {
    if (type === 'bot'  && !$('flBot').checked)  return;
    if (type === 'self' && !$('flSelf').checked) return;

    const el  = $('logOutput');
    const row = document.createElement('div');
    row.className  = 'log-entry';
    row.dataset.lt = type;

    const t  = new Date().toLocaleTimeString('en-US', { hour12: false });
    const cl = /error|fail|✗/i.test(msg) ? 'err'
             : /✓|complete|connected|joined|left|banned|kicked|created|renamed/i.test(msg) ? 'ok' : '';

    row.innerHTML = `<span class="log-time">${t}</span><span class="log-tag ${type}">${type.toUpperCase()}</span><span class="log-msg ${cl}">${esc(msg)}</span>`;
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
}

// ── tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.mode-bot').forEach(el => el.classList.toggle('hidden', activeTab !== 'bot'));
        document.querySelectorAll('.mode-self').forEach(el => el.classList.toggle('hidden', activeTab !== 'self'));
        loadGuilds(activeTab);
    });
});

// ── bot connect ───────────────────────────────────────────────────────────────
$('botConnectBtn').addEventListener('click', async () => {
    const token = $('botToken').value.trim();
    if (!token) return appendLog('bot', 'no token');
    appendLog('bot', 'connecting...');
    const res = await api('/api/bot/connect', { token });
    if (!res.ok) return appendLog('bot', `failed: ${res.error}`);
    appendLog('bot', `connected → ${res.tag}`);
    $('botInfo').textContent = `▶ ${res.tag}`;
    $('botInfo').classList.remove('hidden');
    $('botStatus').textContent = `BOT: ${res.tag}`;
    $('botStatus').classList.add('bot-on');
    $('botExecBtn').disabled = false;
    startPolling();
    if (activeTab === 'bot') renderGuildList(res.guilds, 'bot');
});

// ── self connect ──────────────────────────────────────────────────────────────
$('selfConnectBtn').addEventListener('click', async () => {
    const token = $('selfToken').value.trim();
    if (!token) return appendLog('self', 'no token');
    appendLog('self', 'connecting...');
    const res = await api('/api/self/connect', { token });
    if (!res.ok) return appendLog('self', `failed: ${res.error}`);
    appendLog('self', `connected → ${res.tag}`);
    $('selfInfo').textContent = `▶ ${res.tag}`;
    $('selfInfo').classList.remove('hidden');
    $('selfStatus').textContent = `SELF: ${res.tag}`;
    $('selfStatus').classList.add('self-on');
    $('selfExecBtn').disabled  = false;
    $('raidBtn').disabled      = false;
    $('usernameBtn').disabled  = false;
    startPolling();
    if (activeTab === 'self') renderGuildList(res.guilds, 'self');
});

// ── guilds ────────────────────────────────────────────────────────────────────
async function loadGuilds(mode) {
    const res = await fetch(`/api/${mode}/guilds`).then(r => r.json()).catch(() => null);
    if (res?.ok) renderGuildList(res.guilds, mode);
    else $('guildList').innerHTML = '<span class="muted">not connected</span>';
}

function renderGuildList(guilds, mode) {
    const list = $('guildList');
    list.innerHTML = '';
    if (!guilds?.length) { list.innerHTML = '<span class="muted">no servers</span>'; return; }
    guilds.forEach(g => {
        const item = document.createElement('div');
        item.className    = 'guild-item';
        item.dataset.id   = g.id;
        item.dataset.mode = mode;
        item.innerHTML    = `<div class="g-name">${esc(g.name)}</div><div class="g-mem">${g.memberCount ?? 0} members</div>`;
        item.addEventListener('click', () => selectGuild(g.id, item, mode));
        list.appendChild(item);
    });
}

async function selectGuild(id, el, mode) {
    document.querySelectorAll('.guild-item').forEach(i => i.classList.remove('bot-active','self-active'));
    el.classList.add(`${mode}-active`);
    if (mode === 'bot') selectedBotGuild  = id;
    else                selectedSelfGuild = id;

    const res = await fetch(`/api/${mode}/guild/${id}`).then(r => r.json()).catch(() => null);
    if (res?.ok) {
        const g = res.guild;
        const rows = [['Name',g.name],['Members',g.memberCount??0],['Channels',g.channelCount],['Roles',g.roleCount],['Owner ID',g.ownerId]];
        if (g.boostLevel !== undefined) rows.push(['Boost',g.boostLevel]);
        $('guildInfo').innerHTML = rows.map(([k,v]) =>
            `<div class="row"><span>${k}</span><span>${esc(String(v))}</span></div>`
        ).join('');
    }
}

// ── presets ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.btn.preset').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        const gid  = mode === 'bot' ? selectedBotGuild : selectedSelfGuild;
        if (!gid) return appendLog(mode, 'select a server first');
        const map  = mode === 'bot' ? BOT_PRESETS : SELF_PRESETS;
        const ops  = map[btn.dataset.preset];
        if (!ops) return;
        appendLog(mode, `preset → ${btn.dataset.preset}`);
        executeOps(mode, ops);
    });
});

// ── execute ───────────────────────────────────────────────────────────────────
$('botExecBtn').addEventListener('click', () => {
    if (!selectedBotGuild) return appendLog('bot', 'select a server first');
    const ops = [...document.querySelectorAll('[data-mode="bot"][data-op]:checked')].map(c => c.dataset.op);
    if (!ops.length) return appendLog('bot', 'nothing selected');
    appendLog('bot', `executing: ${ops.join(', ')}`);
    executeOps('bot', ops);
});

$('selfExecBtn').addEventListener('click', () => {
    if (!selectedSelfGuild) return appendLog('self', 'select a server first');
    const ops = [...document.querySelectorAll('[data-mode="self"][data-op]:checked')].map(c => c.dataset.op);
    if (!ops.length) return appendLog('self', 'nothing selected');
    appendLog('self', `executing: ${ops.join(', ')}`);
    executeOps('self', ops);
});

async function executeOps(mode, ops) {
    if (mode === 'bot') {
        const res = await api('/api/bot/nuke', {
            guildId:    selectedBotGuild,
            operations: ops,
            spamName:   $('botSpamName').value    || 'nuked',
            spamCount:  $('botSpamCount').value   || '50',
            serverName: $('botServerName').value  || '☢ NUKED ☢',
        });
        if (!res.ok) appendLog('bot', `error: ${res.error}`);
    } else {
        const res = await api('/api/self/nuke', {
            guildId:    selectedSelfGuild,
            operations: ops,
            spamName:   $('selfSpamName').value   || 'nuked',
            spamCount:  $('selfSpamCount').value  || '20',
            serverName: $('selfServerName').value || '☢ NUKED ☢',
            spamMsg:    $('selfSpamMsg').value     || '☢ nuked ☢',
            dmMsg:      $('selfDmMsg').value       || '☢ server is dead ☢',
        });
        if (!res.ok) appendLog('self', `error: ${res.error}`);
    }
}

// ── raid ──────────────────────────────────────────────────────────────────────
$('raidBtn').addEventListener('click', async () => {
    let invite = $('inviteInput').value.trim();
    if (!invite) return appendLog('self', 'no invite');
    invite = invite.replace(/https?:\/\/discord\.(gg|com\/invite)\//, '').trim();
    const preset = $('raidPreset').value;
    const ops    = SELF_PRESETS[preset] || ['fullRageNuke'];
    appendLog('self', `raiding: ${invite} → ${preset}`);
    const res = await api('/api/self/raid', { inviteCode: invite, operations: ops });
    if (!res.ok) appendLog('self', `raid error: ${res.error}`);
});

// ── username ──────────────────────────────────────────────────────────────────
$('usernameBtn').addEventListener('click', async () => {
    const name = $('newUsername').value.trim();
    if (!name) return appendLog('self', 'no username');
    const res = await api('/api/self/username', { name });
    appendLog('self', res.ok ? `username → ${name}` : `username error: ${res.error}`);
});

// ── log filters ───────────────────────────────────────────────────────────────
['flBot','flSelf'].forEach(id => {
    $(id).addEventListener('change', () => {
        const showB = $('flBot').checked, showS = $('flSelf').checked;
        document.querySelectorAll('.log-entry').forEach(el => {
            const t = el.dataset.lt;
            el.style.display = (t==='bot'&&!showB)||(t==='self'&&!showS) ? 'none' : '';
        });
    });
});

$('clearLog').addEventListener('click', () => { $('logOutput').innerHTML = ''; });
