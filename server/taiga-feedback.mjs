/**
 * Create Taiga user stories for Pointy feedback.
 *
 * Runs on the WebSocket host (can reach taiga-back / cabinet taiga.api_root).
 * Cloudflare Pages cannot call Taiga directly (Authentik in front of the public URL).
 */
import { spawnSync } from "child_process";

const DEFAULT_PROJECT_SLUG = "tjw";
const DEFAULT_STATUS = "New";
const DEFAULT_PUBLIC_BASE = "https://taiga.tyler.cloud";

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
 * @returns {{
 *   apiRoot: string,
 *   authToken: string,
 *   projectSlug: string,
 *   statusName: string,
 *   publicBaseUrl: string,
 * }}
 */
export function loadTaigaConfig() {
  const apiRoot = (
    process.env.TAIGA_API_ROOT ||
    cabinetGet("taiga", "api_root") ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  const authToken = (
    process.env.TAIGA_AUTH_TOKEN ||
    cabinetGet("taiga", "auth_token") ||
    ""
  ).trim();
  const publicBaseUrl = (
    process.env.TAIGA_PUBLIC_BASE_URL ||
    cabinetGet("taiga", "base_url") ||
    DEFAULT_PUBLIC_BASE
  )
    .trim()
    .replace(/\/$/, "");
  const projectSlug = (
    process.env.TAIGA_PROJECT_SLUG ||
    DEFAULT_PROJECT_SLUG
  ).trim();
  const statusName = (process.env.TAIGA_STATUS || DEFAULT_STATUS).trim();

  return { apiRoot, authToken, projectSlug, statusName, publicBaseUrl };
}

/**
 * @param {string} token
 */
function authHeaders(token) {
  const scheme = token.split(".").length === 3 ? "Bearer" : "Application";
  return {
    Authorization: `${scheme} ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * @param {string} name
 * @param {string} slug
 * @param {string} selector
 */
function statusMatches(name, slug, selector) {
  const want = selector.trim().toLowerCase();
  return (
    (name || "").trim().toLowerCase() === want ||
    (slug || "").trim().toLowerCase() === want
  );
}

/**
 * @param {{
 *   subject?: string,
 *   description: string,
 *   config?: ReturnType<typeof loadTaigaConfig>,
 * }} params
 * @returns {Promise<{ ref: number, id: number, url: string }>}
 */
export async function createPointyFeedbackTicket(params) {
  const config = params.config || loadTaigaConfig();
  const subject = (params.subject || "Pointy Feedback").trim() || "Pointy Feedback";
  const description = typeof params.description === "string" ? params.description : "";

  if (!config.apiRoot || !config.authToken) {
    throw new Error(
      "Taiga is not configured (set TAIGA_API_ROOT + TAIGA_AUTH_TOKEN, or cabinet taiga.*)"
    );
  }

  const headers = authHeaders(config.authToken);

  const projectRes = await fetch(
    `${config.apiRoot}/projects/by_slug?slug=${encodeURIComponent(config.projectSlug)}`,
    { headers }
  );
  if (!projectRes.ok) {
    throw new Error(
      `Taiga project lookup failed (${projectRes.status}): ${(await projectRes.text()).slice(0, 400)}`
    );
  }
  const project = await projectRes.json();
  const projectId = project.id;

  const statusesRes = await fetch(
    `${config.apiRoot}/userstory-statuses?project=${projectId}`,
    { headers }
  );
  if (!statusesRes.ok) {
    throw new Error(
      `Taiga statuses failed (${statusesRes.status}): ${(await statusesRes.text()).slice(0, 400)}`
    );
  }
  /** @type {Array<{ id: number, name?: string, slug?: string }>} */
  const statuses = await statusesRes.json();
  const status =
    statuses.find((s) => statusMatches(s.name || "", s.slug || "", config.statusName)) ||
    statuses[0];
  if (!status) {
    throw new Error("Taiga project has no user-story statuses");
  }

  const createRes = await fetch(`${config.apiRoot}/userstories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      project: projectId,
      subject,
      description,
      status: status.id,
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `Taiga create user story failed (${createRes.status}): ${(await createRes.text()).slice(0, 800)}`
    );
  }
  const story = await createRes.json();
  const ref = Number(story.ref);
  const id = Number(story.id);
  if (!Number.isFinite(ref) || !Number.isFinite(id)) {
    throw new Error(`Taiga create returned unexpected payload: ${JSON.stringify(story).slice(0, 400)}`);
  }

  const url = `${config.publicBaseUrl}/project/${config.projectSlug}/us/${ref}`;
  return { ref, id, url };
}
