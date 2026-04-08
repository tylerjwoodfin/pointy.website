/**
 * WebSocket URL for the Pointing Showdown server.
 *
 * - **Development:** same host:port as the page + `/pointing-showdown-ws` so CRA proxies to
 *   the Node server (one firewall hole: 3000). Use `setupProxy.js` + `craco` upgrade.
 * - **Production:** direct `hostname:3333` (or set env). Bind game server with `0.0.0.0`.
 *
 * Override anytime: `REACT_APP_POINTING_BLACKJACK_WS` (full URL, no trailing slash).
 * Port override (production): `REACT_APP_POINTING_BLACKJACK_PORT`.
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
