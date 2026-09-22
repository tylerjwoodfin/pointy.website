/**
 * Send the Pointy session summary to the same address as Pointy feedback.
 *
 * Feedback mail is sent by the Cloudflare Pages function with
 * RESEND_API_KEY, FEEDBACK_EMAIL_FROM, and FEEDBACK_EMAIL_TO.
 * This host uses those env vars when set. Otherwise it reads Cabinet
 * `keys.resend.token`, `pointy.feedback_email_from`, and `pointy.feedback_email_to`.
 */
import { spawnSync } from "child_process";

export const SESSION_SUMMARY_SUBJECT = "Pointy Session Summary";

/**
 * @param {...string} path
 * @returns {string}
 */
function cabinetGet(...path) {
  const bin = process.env.CABINET_BIN || "cabinet";
  const env = { ...process.env };
  const home = env.HOME || "";
  if (home) {
    const localBin = `${home}/.local/bin`;
    env.PATH = env.PATH ? `${localBin}:${env.PATH}` : localBin;
  }
  const result = spawnSync(bin, ["--get", ...path], {
    encoding: "utf8",
    env,
    timeout: 10_000,
  });
  if (result.status !== 0) return "";
  return (result.stdout || "").trim();
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {(...path: string[]) => string} [readCabinet]
 * @returns {{ apiKey: string, from: string, to: string } | null}
 */
export function loadFeedbackMailConfig(env = process.env, readCabinet = cabinetGet) {
  let cabinetKey = "";
  if (!(env.RESEND_API_KEY || "").trim()) {
    try {
      cabinetKey = readCabinet("keys", "resend", "token") || "";
    } catch {
      cabinetKey = "";
    }
  }
  let cabinetFrom = "";
  let cabinetTo = "";
  if (!(env.FEEDBACK_EMAIL_FROM || "").trim() || !(env.FEEDBACK_EMAIL_TO || "").trim()) {
    try {
      if (!(env.FEEDBACK_EMAIL_FROM || "").trim()) {
        cabinetFrom = readCabinet("pointy", "feedback_email_from") || "";
      }
      if (!(env.FEEDBACK_EMAIL_TO || "").trim()) {
        cabinetTo = readCabinet("pointy", "feedback_email_to") || "";
      }
    } catch {
      cabinetFrom = "";
      cabinetTo = "";
    }
  }
  const apiKey = (env.RESEND_API_KEY || cabinetKey || "").trim();
  const from = (env.FEEDBACK_EMAIL_FROM || cabinetFrom || "").trim();
  const to = (env.FEEDBACK_EMAIL_TO || cabinetTo || "").trim();
  if (!apiKey || !from || !to) return null;
  return { apiKey, from, to };
}

/**
 * @param {{
 *   text: string,
 *   html?: string,
 *   subject?: string,
 *   config?: { apiKey: string, from: string, to: string } | null,
 *   fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<boolean>}
 */
export async function sendSessionSummaryEmail(params) {
  const text = typeof params.text === "string" ? params.text.trim() : "";
  const html = typeof params.html === "string" ? params.html.trim() : "";
  if (!text && !html) return false;

  const config =
    params.config === undefined ? loadFeedbackMailConfig() : params.config;
  if (!config) {
    console.error(
      "Session summary email not configured (RESEND_API_KEY / keys.resend.token)"
    );
    return false;
  }

  const fetchImpl = params.fetchImpl || fetch;
  const subject = (params.subject || SESSION_SUMMARY_SUBJECT).trim() || SESSION_SUMMARY_SUBJECT;

  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`Session summary email failed (${res.status}): ${detail.slice(0, 500)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Session summary email failed:", err);
    return false;
  }
}
