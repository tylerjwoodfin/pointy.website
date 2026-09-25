import assert from "node:assert/strict";
import test from "node:test";
import {
  canSeeLiveVoteCounts,
  liveVoteCountsForViewer,
} from "./live-vote-counts.mjs";

test("Product/BA and the name Tyler can see live counts", () => {
  assert.equal(canSeeLiveVoteCounts({ name: "Sam", role: "product" }), true);
  assert.equal(canSeeLiveVoteCounts({ name: "Tyler", role: "dev" }), true);
  assert.equal(canSeeLiveVoteCounts({ name: " tyler ", role: "qa" }), true);
  assert.equal(canSeeLiveVoteCounts({ name: "Tyler W", role: "dev" }), false);
  assert.equal(canSeeLiveVoteCounts({ name: "Sam", role: "dev" }), false);
  assert.equal(canSeeLiveVoteCounts(null), false);
});

function session() {
  return {
    revealed: false,
    players: new Map([
      ["p", { name: "Pat", role: "product" }],
      ["t", { name: "Tyler", role: "dev" }],
      ["d", { name: "Sam", role: "dev" }],
    ]),
    votes: new Map([
      ["d", 5],
    ]),
    participation: {
      rounds: 4,
      players: {
        p: { votes: 0 },
        t: { votes: 4 },
        d: { votes: 0 },
      },
    },
  };
}

test("open round counts as so-far and includes a vote already cast", () => {
  const counts = liveVoteCountsForViewer(session(), "p");
  assert.deepEqual(counts, {
    rounds: 5,
    votesByPlayer: { p: 0, t: 4, d: 1 },
  });
  assert.equal(liveVoteCountsForViewer(session(), "t")?.rounds, 5);
  assert.equal(liveVoteCountsForViewer(session(), "d"), null);
});

test("a revealed round is not counted twice", () => {
  const s = session();
  s.revealed = true;
  s.participation.rounds = 5;
  s.participation.players.d.votes = 1;
  assert.deepEqual(liveVoteCountsForViewer(s, "t"), {
    rounds: 5,
    votesByPlayer: { p: 0, t: 4, d: 1 },
  });
});
