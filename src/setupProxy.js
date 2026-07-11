const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = Number(process.env.POINTING_BLACKJACK_PORT || 3333);

const POINTING_WS_PATH = "/pointing-showdown-ws";

/**
 * Dev-only HTTP handler + WebSocket upgrade for Pointing Blackjack.
 *
 * The first argument **must** be the path context. If you pass only `{ target }`,
 * http-proxy-middleware defaults context to `/` and proxies **every** upgrade —
 * including webpack-dev-server HMR on `/ws`, which breaks hot reload and extra
 * browser connections (ECONNREFUSED, `target` undefined in logs).
 */
const pointingBlackjackProxy = createProxyMiddleware(POINTING_WS_PATH, {
  target: `http://127.0.0.1:${PORT}`,
  changeOrigin: true,
  ws: true,
});

module.exports = function setupProxy(app) {
  app.use(POINTING_WS_PATH, pointingBlackjackProxy);
};

module.exports.getPointingBlackjackWsUpgrade = function getPointingBlackjackWsUpgrade() {
  return pointingBlackjackProxy.upgrade;
};

module.exports.POINTING_WS_PATH = POINTING_WS_PATH;
