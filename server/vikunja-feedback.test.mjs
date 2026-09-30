import assert from "node:assert/strict";
import test from "node:test";
import { createPointyFeedbackTicket, loadVikunjaConfig } from "./vikunja-feedback.mjs";

const config = {
  apiRoot: "http://vikunja.test/api/v1",
  authToken: "tok",
  publicBaseUrl: "https://v.tyler.cloud",
};

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function jsonResponse(body, status = 200) {
  return {
    ok: status < 400,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("loadVikunjaConfig reads env and strips trailing slashes", () => {
  const previous = {
    root: process.env.VIKUNJA_API_ROOT,
    token: process.env.VIKUNJA_API_TOKEN,
    base: process.env.VIKUNJA_BASE_URL,
  };
  process.env.VIKUNJA_API_ROOT = "http://127.0.0.1:3456/api/v1/";
  process.env.VIKUNJA_API_TOKEN = "secret-token";
  process.env.VIKUNJA_BASE_URL = "https://v.tyler.cloud/";
  try {
    const loaded = loadVikunjaConfig();
    assert.equal(loaded.apiRoot, "http://127.0.0.1:3456/api/v1");
    assert.equal(loaded.authToken, "secret-token");
    assert.equal(loaded.publicBaseUrl, "https://v.tyler.cloud");
  } finally {
    restoreEnv("VIKUNJA_API_ROOT", previous.root);
    restoreEnv("VIKUNJA_API_TOKEN", previous.token);
    restoreEnv("VIKUNJA_BASE_URL", previous.base);
  }
});

test("createPointyFeedbackTicket requires a token", async () => {
  await assert.rejects(
    () =>
      createPointyFeedbackTicket({
        description: "hello there",
        config: { apiRoot: "http://vikunja.test/api/v1", authToken: "", publicBaseUrl: "https://v.tyler.cloud" },
      }),
    /Vikunja is not configured/
  );
});

test("createPointyFeedbackTicket puts a TJW task in New", async () => {
  /** @type {Array<{ url: string, method: string, body?: string, authorization?: string }>} */
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({
      url: String(url),
      method: opts.method || "GET",
      body: typeof opts.body === "string" ? opts.body : undefined,
      authorization: opts.headers?.Authorization,
    });
    const target = String(url);
    if (target.endsWith("/projects")) {
      return jsonResponse([
        { id: 9, identifier: "OTHER" },
        { id: 3, identifier: "TJW" },
      ]);
    }
    if (target.endsWith("/projects/3/views")) {
      return jsonResponse([
        { id: 11, view_kind: "list" },
        { id: 12, view_kind: "kanban" },
      ]);
    }
    if (target.endsWith("/projects/3/views/12/buckets")) {
      return jsonResponse([
        { id: 1, title: "Testing" },
        { id: 2, title: "New" },
      ]);
    }
    if (target.endsWith("/projects/3/tasks")) {
      return jsonResponse({ id: 99, index: 413 });
    }
    return jsonResponse({ error: "unexpected" }, 500);
  };

  try {
    const ticket = await createPointyFeedbackTicket({
      subject: "Pointy Feedback",
      description: "The cards overlapped",
      config,
    });
    assert.deepEqual(ticket, {
      ref: 413,
      id: 99,
      url: "https://v.tyler.cloud/tasks/99",
    });
  } finally {
    globalThis.fetch = original;
  }

  assert.equal(calls.length, 4);
  assert.equal(calls[0].authorization, "Bearer tok");
  const create = calls[3];
  assert.equal(create.method, "PUT");
  assert.deepEqual(JSON.parse(create.body || "{}"), {
    title: "Pointy Feedback",
    description: "The cards overlapped",
    bucket_id: 2,
    done: false,
  });
});

test("createPointyFeedbackTicket rejects a payload without an index", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith("/projects")) return jsonResponse([{ id: 3, identifier: "TJW" }]);
    if (target.endsWith("/views")) return jsonResponse([{ id: 12, view_kind: "kanban" }]);
    if (target.endsWith("/buckets")) return jsonResponse([{ id: 2, title: "New" }]);
    return jsonResponse({ id: 99 });
  };
  try {
    await assert.rejects(
      () => createPointyFeedbackTicket({ description: "hello there", config }),
      /unexpected payload/
    );
  } finally {
    globalThis.fetch = original;
  }
});

/**
 * @param {string} key
 * @param {string | undefined} value
 */
function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
