/**
 * WebSocket URL for the Pointing Showdown server.
 *
 * - **Development:** same host as the page + `/pointing-showdown-ws` (CRA proxy → Node :3333).
 * - **Production (Cloudflare Pages):** set `REACT_APP_POINTING_BLACKJACK_WS` at build time, e.g.
 *   `wss://pointing-ws.tyler.cloud`, and run the Node server + `cloudflared` tunnel on your host
 *   (see repo `cloudflared-setup/pointing-showdown.yml` and `.env.production.example`).
 * - **Production fallback (no env):** `wss://<page-host>:3333` — wrong on static hosts; always set env for deploys.
 *
 * Override: `REACT_APP_POINTING_BLACKJACK_WS` (no trailing slash). Port: `REACT_APP_POINTING_BLACKJACK_PORT`.
 */
export function pointingBlackjackWsUrl(): string {
  const env = process.env.REACT_APP_POINTING_BLACKJACK_WS;
  if (env) {
    return env.replace(/\/$/, "");
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (process.env.NODE_ENV === "development") {
    return `${proto}//${window.location.host}/pointing-showdown-ws`;
  }
  const port = process.env.REACT_APP_POINTING_BLACKJACK_PORT || "3333";
  return `${proto}//${window.location.hostname}:${port}`;
}
