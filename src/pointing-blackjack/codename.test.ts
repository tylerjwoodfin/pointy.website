import { uniqueCodename } from "./codename";

describe("uniqueCodename", () => {
  it("returns an adjective-animal pair", () => {
    const name = uniqueCodename([]);
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("avoids names already taken in the session", () => {
    const used = ["Swift Fox", "Clever Panda"];
    for (let i = 0; i < 20; i++) {
      const name = uniqueCodename(used);
      expect(used.some((n) => n.toLowerCase() === name.toLowerCase())).toBe(false);
    }
  });
});
