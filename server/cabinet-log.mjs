/**
 * Fire-and-forget usage metrics via the Cabinet CLI.
 *
 * Cabinet is Python-only (`cab.log` / `cabinet --log`); this Node WebSocket
 * server cannot import it. On the host that runs pointing-blackjack, shell out
 * to `cabinet` so events land in the same local logs / Loki pipeline as
 * everything else.
 *
 * Ensure the service can resolve the binary (systemd often lacks ~/.local/bin):
 *   Environment=CABINET_BIN=/home/YOU/.local/bin/cabinet
 * or prepend ~/.local/bin to PATH (see pointing-blackjack.service.example).
 */
import { spawn } from "child_process";

const TAG = "pointy";
const LEVEL = "info";

/**
 * @param {string} message
 */
export function cabinetLog(message) {
  if (typeof message !== "string" || !message.trim()) return;

  const bin = process.env.CABINET_BIN || "cabinet";
  const env = { ...process.env };
  const home = env.HOME || "";
  if (home) {
    const localBin = `${home}/.local/bin`;
    env.PATH = env.PATH ? `${localBin}:${env.PATH}` : localBin;
  }

  let child;
  try {
    child = spawn(
      bin,
      ["--log", message, "--level", LEVEL, "--tags", TAG],
      {
        env,
        detached: true,
        stdio: "ignore",
      }
    );
  } catch (err) {
    console.error("cabinet log spawn failed:", err);
    return;
  }

  child.on("error", (err) => {
    console.error("cabinet log failed:", err.message);
  });
  child.unref();
}
