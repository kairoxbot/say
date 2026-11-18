# ☢ discord-nuke v4 — Vercel

Socket.io reemplazado con polling HTTP. Funciona en Vercel.

## Deploy

```bash
npm i -g vercel
vercel --prod
# → pon tu dominio en Vercel dashboard → Settings → Domains
```

O desde GitHub:
1. Push a GitHub
2. vercel.com → New Project → Import repo
3. Listo. Detecta `vercel.json` automáticamente

## Local

```bash
npm install
node api/server.js
# → http://localhost:3000
```

## Estructura

```
api/server.js      ← Express, todas las rutas, estado en módulo global
nuker.js           ← ops de bot (v14)
selfnuker.js       ← ops de selfbot (v13)
public/            ← frontend estático
vercel.json        ← rewrite → /api/server
```

## Cambios vs versión anterior

- **Sin socket.io** — reemplazado con polling cada 500ms a `/api/logs`
- `vercel.json` rutea todo a `api/server.js` como Express handler
- Estado (clientes Discord) en módulo global — persiste mientras Vercel mantenga la instancia caliente
- Si la instancia se enfría (inactividad larga), hay que reconectar el token

## Nota sobre `maxDuration: 60`

El `vercel.json` incluye `maxDuration: 60`. En free tier Vercel el límite es 10s — las ops cortas funcionan igual, las ops largas como full nuke pueden cortarse. En Hobby/Pro el límite es 60s.
