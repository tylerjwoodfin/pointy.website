import assert from "node:assert/strict";
import test from "node:test";
import {
  ADJECTIVES,
  ANIMALS,
  MYTHICAL,
  PLANTS,
  TITLES,
  canToggleFunNames,
  uniqueFunTitle,
} from "./fun-name.mjs";

const NOUNS = new Set([...ANIMALS, ...MYTHICAL, ...TITLES, ...PLANTS]);

test("fun titles are an adjective plus a noun from every pool", () => {
  assert.ok(ADJECTIVES.includes("Sleepy"));
  assert.ok(ADJECTIVES.length > 30);
  assert.ok(ANIMALS.includes("Eagle"));
  assert.ok(MYTHICAL.includes("Dragon"));
  assert.ok(TITLES.includes("Scrum Master"));
  assert.ok(PLANTS.includes("Fern"));

  for (let i = 0; i < 40; i++) {
    const title = uniqueFunTitle([]);
    const adjective = ADJECTIVES.find((word) => title.startsWith(`${word} `));
    assert.ok(adjective, title);
    const noun = title.slice(adjective.length + 1);
    assert.ok(NOUNS.has(noun), noun);
  }
});

test("uniqueFunTitle avoids titles already used", () => {
  const used = ["Sleepy Eagle", "Swift Fox"];
  for (let i = 0; i < 30; i++) {
    const title = uniqueFunTitle(used);
    assert.equal(used.some((taken) => taken.toLowerCase() === title.toLowerCase()), false);
  }
});

test("only a BA or Tyler can toggle fun names", () => {
  assert.equal(canToggleFunNames({ name: "Sam", role: "product" }), true);
  assert.equal(canToggleFunNames({ name: "Tyler", role: "dev" }), true);
  assert.equal(canToggleFunNames({ name: " tyler ", role: "qa" }), true);
  assert.equal(canToggleFunNames({ name: "Tyler W", role: "dev" }), false);
  assert.equal(canToggleFunNames({ name: "Sam", role: "dev" }), false);
  assert.equal(canToggleFunNames(null), false);
});
