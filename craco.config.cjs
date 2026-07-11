const fs = require("fs");
const path = require("path");

/**
 * Register http-proxy-middleware's WebSocket `upgrade` handler on the dev
 * server's HTTP server (setupProxy.js only attaches Express middleware).
 */
module.exports = {
  devServer: (devServerConfig) => {
    const previousOnListening = devServerConfig.onListening;
    devServerConfig.onListening = (devServer) => {
      if (typeof previousOnListening === "function") {
        previousOnListening(devServer);
      }
      const setupProxyPath = path.join(__dirname, "src", "setupProxy.js");
      if (!fs.existsSync(setupProxyPath)) return;
      // Must be CommonJS–the same instance createProxyMiddleware returned in setupProxy.
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const setupProxy = require(setupProxyPath);
      if (typeof setupProxy.getPointingBlackjackWsUpgrade !== "function") return;
      const onUpgrade = setupProxy.getPointingBlackjackWsUpgrade();
      if (onUpgrade && devServer.server) {
        devServer.server.on("upgrade", onUpgrade);
      }
    };
    return devServerConfig;
  },
};
