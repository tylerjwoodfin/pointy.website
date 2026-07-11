# pointy.website

**Pointy** — a simple, free and open-source sprint pointing tool.

Host a live table, share a room code or link, and point stories together in real time over WebSockets.

Originally extracted from [tyler.cloud](https://github.com/tylerjwoodfin/tyler.cloud); licensed under Apache-2.0.

## Features

- Create or join a session with a short room code (or join anonymously)
- Product / QA / Dev roles at the table
- Real-time votes and reveal
- BRB / away status for players
- Frequency chart of point distribution
- Invite link you can copy and share
- In-session feedback form
- Session persistence in Supabase (survives server restarts; 2-hour TTL)

## Quick start

```bash
npm install
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example),
# and run the SQL under supabase/migrations/ in your Supabase project.
npm run dev
```

That starts:

- the React app on [http://localhost:3000](http://localhost:3000)
- the WebSocket session server on `ws://localhost:3333` (proxied in dev as `/pointy-ws`)

The WebSocket server **requires** Supabase credentials; without them it exits on startup.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | App + WebSocket server together (recommended) |
| `npm start` | React app only (needs `npm run server` in another terminal) |
| `npm run server` | WebSocket session server only |
| `npm test` | Jest / React Testing Library |
| `npm run build` | Production static build |

## Production (Cloudflare)

Same split as the former tyler.cloud hosting:

| Piece | Host | How |
|-------|------|-----|
| React app | `https://pointy.website` | Cloudflare Pages (`npm run build` → `build/`) |
| WebSocket | `wss://ws.pointy.website` | Cloudflare Tunnel → local Node `:3333` |
| Persistence | Supabase | `SUPABASE_*` on the Node host |

`public/_redirects` sends all routes to `index.html` so `/ROOM` deep links work on Pages.

### 1. Cloudflare zone + DNS

1. In Cloudflare: **Add site** → `pointy.website` (Free plan is fine).
2. At Namecheap: set nameservers to the two Cloudflare NS values shown for the zone.
3. Wait until the zone is **Active**.

### 2. Cloudflare Pages

Deployments are automatic via GitHub Actions (`.github/workflows/deploy-pages.yml`) on every push to `main`.

Pages project: `pointy-website` · build env bakes in `REACT_APP_POINTING_BLACKJACK_WS=wss://ws.pointy.website`.

Function secrets (feedback): `RESEND_API_KEY`, `FEEDBACK_EMAIL_FROM`, `FEEDBACK_EMAIL_TO`.

### 3. WebSocket tunnel + Node server

On the host (already running the Pointy WebSocket service):

```bash
# After the zone is Active — routes DNS + refreshes tunnel ingress:
~/git/cloudflared-setup/setup-pointy-website.sh

# Serve from this repo (same Supabase env file as before):
sudo systemctl restart pointing-blackjack
```

Tunnel config: `cloudflared-setup/pointing-showdown.yml`  
(`pointing-ws.tyler.cloud` and `ws.pointy.website` both hit `:3333`).

See `.env.example` and `server/pointing-blackjack.service.example`.

## Routes

| Path | Screen |
|------|--------|
| `/` | Lobby |
| `/:sessionId` | Live session |

## License

Apache-2.0 — see [LICENSE](LICENSE).
