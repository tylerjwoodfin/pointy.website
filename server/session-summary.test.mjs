import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyParticipation,
  formatSessionSummary,
  formatSessionSummaryHtml,
  isExcludedFromSummary,
  LEAVE_SUMMARY_GRACE_MS,
  MIN_SUMMARY_PARTICIPANTS,
  normalizeParticipation,
  OFFLINE_SUMMARY_GRACE_MS,
  recordRevealedRound,
  summaryDelayMs,
  touchParticipant,
} from "./session-summary.mjs";
import {
  sendSessionSummaryEmail,
  SESSION_SUMMARY_SUBJECT,
} from "./session-summary-mail.mjs";

test("counts a vote only when that round is revealed", () => {
  const participation = emptyParticipation();
  touchParticipant(participation, "a", { name: "Tyler", role: "dev" });
  touchParticipant(participation, "b", { name: "Jordan", role: "qa" });
  touchParticipant(participation, "c", { name: "BA", role: "product" });

  recordRevealedRound(participation, [
    ["a", 5],
    ["b", 8],
    ["c", 3],
  ]);
  recordRevealedRound(participation, [
    ["a", 5],
    ["b", null],
  ]);

  assert.equal(participation.rounds, 2);
  assert.equal(participation.players.a.votes, 2);
  assert.equal(participation.players.b.votes, 1);
  assert.equal(participation.players.c.votes, 1);
});

test("formats names and omits BA", () => {
  const participation = emptyParticipation();
  touchParticipant(participation, "a", { name: "Tyler", role: "dev" });
  touchParticipant(participation, "b", { name: "jordan", role: "qa" });
  touchParticipant(participation, "c", { name: "BA", role: "product" });
  recordRevealedRound(participation, [
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ]);
  for (let i = 0; i < 4; i += 1) {
    recordRevealedRound(participation, [
      ["a", 1],
      ["b", 2],
    ]);
  }

  assert.equal(isExcludedFromSummary("BA"), true);
  assert.equal(isExcludedFromSummary(" ba "), true);
  assert.equal(isExcludedFromSummary("Barbara"), false);
  assert.equal(
    formatSessionSummary(participation),
    ["jordan / 5 out of 5 rounds", "Tyler / 5 out of 5 rounds"].join("\n")
  );
  const html = formatSessionSummaryHtml(participation, "room1");
  assert.match(html, /^<table/);
  assert.match(html, /<th[^>]*>Name<\/th><th[^>]*>Votes<\/th>/);
  assert.match(html, /<td[^>]*>Tyler<\/td><td[^>]*>5 out of 5 rounds<\/td>/);
  assert.match(html, /<td[^>]*>jordan<\/td><td[^>]*>5 out of 5 rounds<\/td>/);
  assert.equal(html.includes(">BA<"), false);
  assert.match(formatSessionSummaryHtml(participation, 'a<b>&"'), /Room a&lt;b&gt;&amp;&quot;/);
});

test("uses singular round when only one round was revealed", () => {
  const participation = emptyParticipation();
  touchParticipant(participation, "a", { name: "Tyler", role: "dev" });
  recordRevealedRound(participation, [["a", 8]]);
  assert.equal(formatSessionSummary(participation), "Tyler / 1 out of 1 round");
});

test("keeps vote totals when a player renames, and does not reset on rejoin", () => {
  const participation = emptyParticipation();
  touchParticipant(participation, "a", { name: "Tyler", role: "dev" });
  recordRevealedRound(participation, [["a", 5]]);
  touchParticipant(participation, "a", { name: "Tyler W", role: "dev" });
  assert.equal(participation.players.a.votes, 1);
  assert.equal(participation.players.a.name, "Tyler W");
});

test("BA still counts toward the three-person minimum but is left out of the email", () => {
  const participation = emptyParticipation();
  touchParticipant(participation, "a", { name: "Tyler", role: "dev" });
  touchParticipant(participation, "b", { name: "Jordan", role: "qa" });
  touchParticipant(participation, "c", { name: "BA", role: "product" });
  assert.equal(Object.keys(participation.players).length, MIN_SUMMARY_PARTICIPANTS);
  assert.equal(
    summaryDelayMs({ online: 0, playersRemaining: 0, participation }),
    LEAVE_SUMMARY_GRACE_MS
  );
  assert.equal(formatSessionSummary(participation).includes("BA"), false);
});

test("does not email while someone is online, after send, or for a small session", () => {
  const participation = emptyParticipation();
  touchParticipant(participation, "a", { name: "Tyler", role: "dev" });
  touchParticipant(participation, "b", { name: "Jordan", role: "qa" });
  touchParticipant(participation, "c", { name: "Sam", role: "dev" });

  assert.equal(summaryDelayMs({ online: 1, playersRemaining: 3, participation }), null);
  assert.equal(
    summaryDelayMs({ online: 0, playersRemaining: 2, participation }),
    OFFLINE_SUMMARY_GRACE_MS
  );

  const small = emptyParticipation();
  touchParticipant(small, "a", { name: "Tyler", role: "dev" });
  touchParticipant(small, "b", { name: "Jordan", role: "qa" });
  assert.equal(summaryDelayMs({ online: 0, playersRemaining: 0, participation: small }), null);

  participation.sent = true;
  assert.equal(summaryDelayMs({ online: 0, playersRemaining: 0, participation }), null);
});

test("normalizes stored participation", () => {
  const participation = normalizeParticipation({
    rounds: 4,
    sent: true,
    players: {
      a: { name: "Tyler", role: "dev", votes: 3 },
      b: { name: "", role: "nope", votes: -1 },
    },
  });
  assert.equal(participation.rounds, 4);
  assert.equal(participation.sent, true);
  assert.deepEqual(participation.players.a, { name: "Tyler", role: "dev", votes: 3 });
  assert.deepEqual(participation.players.b, { name: "Player", role: "dev", votes: 0 });
  assert.deepEqual(normalizeParticipation(null), emptyParticipation());
});

test("posts the summary to the feedback address", async () => {
  /** @type {{ url: string, body: unknown, headers: Record<string, string> } | null} */
  let captured = null;
  const ok = await sendSessionSummaryEmail({
    text: "Tyler / 4 out of 5 rounds",
    html: "<table><tr><td>Tyler</td><td>4 out of 5 rounds</td></tr></table>",
    config: {
      apiKey: "test-key",
      from: "noreply@example.com",
      to: "feedback@example.com",
    },
    fetchImpl: async (url, init) => {
      captured = {
        url: String(url),
        body: JSON.parse(String(init && init.body)),
        headers: /** @type {Record<string, string>} */ (init && init.headers),
      };
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(ok, true);
  assert.ok(captured);
  assert.equal(captured.url, "https://api.resend.com/emails");
  assert.equal(captured.headers.Authorization, "Bearer test-key");
  assert.equal(captured.body.subject, SESSION_SUMMARY_SUBJECT);
  assert.deepEqual(captured.body.to, ["feedback@example.com"]);
  assert.equal(captured.body.text, "Tyler / 4 out of 5 rounds");
  assert.match(captured.body.html, /<table>/);
  assert.match(captured.body.html, /4 out of 5 rounds/);
});
