# pointy.website

**Pointing Showdown** — a simple, free and open-source sprint pointing tool.

Host a live table, share a room code or link, and point stories together in real time over WebSockets.

Originally extracted from [tyler.cloud](https://github.com/tylerjwoodfin/tyler.cloud); licensed under Apache-2.0.

## Features

- Create or join a session with a short room code
- Real-time votes and reveal
- BRB / away status for players
- Frequency chart of point distribution
- Invite link you can copy and share

## Quick start

```bash
npm install
npm run dev
```

That starts:

- the React app on [http://localhost:3000](http://localhost:3000)
- the WebSocket session server on `ws://localhost:3333` (proxied in dev as `/pointing-showdown-ws`)

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | App + WebSocket server together (recommended) |
| `npm start` | React app only (needs `npm run server` in another terminal) |
| `npm run server` | WebSocket session server only |
| `npm test` | Jest / React Testing Library |
| `npm run build` | Production static build |

### Production WebSocket URL

For static hosts (e.g. Cloudflare Pages), set at build time:

```bash
REACT_APP_POINTING_BLACKJACK_WS=wss://your-pointing-ws.example.com
```

See `.env.example`. Run `server/pointing-blackjack.mjs` (and optionally the systemd unit example) on a host that can accept WebSocket connections.

## Routes

| Path | Screen |
|------|--------|
| `/` or `/pointing-showdown` | Lobby |
| `/:sessionId` or `/pointing-showdown/:sessionId` | Live session |

## License

Apache-2.0 — see [LICENSE](LICENSE).
