/**
 * Create Vikunja tasks for Pointy feedback.
 *
 * Same board as `v`: TJW project, New column, Cabinet `vikunja.*`
 * (see ~/git/tools/vikunja/main.py).
 *
 * Runs on the WebSocket host, which can reach the loopback Vikunja API.
 * Cloudflare Pages cannot call v.tyler.cloud directly (Authentik).
 */
import { spawnSync } from "child_process";

const DEFAULT_API_ROOT = "http://127.0.0.1:3456/api/v1";
const DEFAULT_PUBLIC_BASE = "https://v.tyler.cloud";
const PROJECT_IDENTIFIER = "TJW";
const NEW_BUCKET = "New";

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
  if (result.status !== 0) {
    return "";
  }
  return (result.stdout || "").trim();
}

/**
 * @param {string | undefined} envValue
 * @param {string[]} cabinetPath
 * @param {string} fallback
 */
function pickConfig(envValue, cabinetPath, fallback) {
  const fromEnv = (envValue || "").trim();
  if (fromEnv) return fromEnv;
  const fromCabinet = cabinetGet(...cabinetPath).trim();
  if (fromCabinet) return fromCabinet;
  return fallback;
}

/**
 * @returns {{
 *   apiRoot: string,
 *   authToken: string,
 *   publicBaseUrl: string,
 * }}
 */
export function loadVikunjaConfig() {
  const apiRoot = pickConfig(
    process.env.VIKUNJA_API_ROOT,
    ["vikunja", "api_root"],
    DEFAULT_API_ROOT
  ).replace(/\/$/, "");
  const authToken = pickConfig(
    process.env.VIKUNJA_API_TOKEN,
    ["vikunja", "api_token"],
    ""
  );
  const publicBaseUrl = pickConfig(
    process.env.VIKUNJA_BASE_URL,
    ["vikunja", "base_url"],
    DEFAULT_PUBLIC_BASE
  ).replace(/\/$/, "");

  return { apiRoot, authToken, publicBaseUrl };
}

/**
 * @param {string} token
 */
function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
async function vikunjaFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    throw new Error(`Vikunja ${init?.method || "GET"} ${url} failed (${res.status}): ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * @param {{
 *   subject?: string,
 *   description: string,
 *   config?: ReturnType<typeof loadVikunjaConfig>,
 * }} params
 * @returns {Promise<{ ref: number, id: number, url: string }>}
 */
export async function createPointyFeedbackTicket(params) {
  const config = params.config || loadVikunjaConfig();
  const subject = (params.subject || "Pointy Feedback").trim() || "Pointy Feedback";
  const rawDescription = typeof params.description === "string" ? params.description : "";
  const description = rawDescription.trim() ? rawDescription : subject;

  if (!config.apiRoot || !config.authToken) {
    throw new Error(
      "Vikunja is not configured (set VIKUNJA_API_ROOT + VIKUNJA_API_TOKEN, or cabinet vikunja.*)"
    );
  }

  const headers = authHeaders(config.authToken);

  /** @type {Array<{ id: number, identifier?: string }>} */
  const projects = await vikunjaFetch(`${config.apiRoot}/projects`, { headers });
  const project = (projects || []).find((row) => row.identifier === PROJECT_IDENTIFIER);
  if (!project) {
    throw new Error(`Vikunja project ${PROJECT_IDENTIFIER} not found`);
  }
  const projectId = project.id;

  /** @type {Array<{ id: number, view_kind?: string }>} */
  const views = await vikunjaFetch(`${config.apiRoot}/projects/${projectId}/views`, { headers });
  const kanban = (views || []).find((view) => view.view_kind === "kanban");
  if (!kanban) {
    throw new Error("TJW has no kanban view");
  }

  /** @type {Array<{ id: number, title?: string }>} */
  const buckets = await vikunjaFetch(
    `${config.apiRoot}/projects/${projectId}/views/${kanban.id}/buckets`,
    { headers }
  );
  const bucket = (buckets || []).find((row) => row.title === NEW_BUCKET);
  if (!bucket) {
    throw new Error(`Kanban column ${JSON.stringify(NEW_BUCKET)} not found`);
  }

  const created = await vikunjaFetch(`${config.apiRoot}/projects/${projectId}/tasks`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      title: subject,
      description,
      bucket_id: bucket.id,
      done: false,
    }),
  });

  const ref = Number(created?.index);
  const id = Number(created?.id);
  if (!Number.isFinite(ref) || !Number.isFinite(id)) {
    throw new Error(
      `Vikunja create returned unexpected payload: ${JSON.stringify(created).slice(0, 400)}`
    );
  }

  return { ref, id, url: `${config.publicBaseUrl}/tasks/${id}` };
}
