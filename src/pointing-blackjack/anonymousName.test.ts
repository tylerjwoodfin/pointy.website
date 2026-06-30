import {
  ANONYMOUS_PREFIX,
  parseAnonymousEmoji,
  uniqueAnonymousName,
} from "./anonymousName";

describe("parseAnonymousEmoji", () => {
  it("reads the emoji from an anonymous name", () => {
    expect(parseAnonymousEmoji("Anonymous 😎")).toBe("😎");
    expect(parseAnonymousEmoji("Tyler")).toBeNull();
  });
});

describe("uniqueAnonymousName", () => {
  it("returns Anonymous plus a face emoji", () => {
    const name = uniqueAnonymousName([]);
    expect(name.startsWith(ANONYMOUS_PREFIX)).toBe(true);
    expect(parseAnonymousEmoji(name)).toBeTruthy();
  });

  it("avoids emojis already used by other anonymous players", () => {
    const used = ["Anonymous 😀", "Anonymous 😃", "Anonymous 😎"];
    for (let i = 0; i < 20; i++) {
      const name = uniqueAnonymousName(used);
      const emoji = parseAnonymousEmoji(name);
      expect(emoji).toBeTruthy();
      expect(used.some((n) => parseAnonymousEmoji(n) === emoji)).toBe(false);
      used.push(name);
    }
  });
});
