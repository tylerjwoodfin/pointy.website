import { canToggleFunNames, funDisplayName } from "./funName";

describe("funDisplayName", () => {
  it("turns Bob into Bob the Sleepy Eagle when fun names are on", () => {
    expect(funDisplayName("Bob", "Sleepy Eagle", true)).toBe("Bob the Sleepy Eagle");
  });

  it("shows the real name when fun names are off", () => {
    expect(funDisplayName("Bob", "Sleepy Eagle", false)).toBe("Bob");
  });

  it("shows the real name when there is no title", () => {
    expect(funDisplayName("Bob", undefined, true)).toBe("Bob");
  });
});

describe("canToggleFunNames", () => {
  it("allows a BA and Tyler", () => {
    expect(canToggleFunNames({ name: "Sam", role: "product" })).toBe(true);
    expect(canToggleFunNames({ name: "Tyler", role: "dev" })).toBe(true);
    expect(canToggleFunNames({ name: " tyler ", role: "qa" })).toBe(true);
  });

  it("hides the option from everyone else", () => {
    expect(canToggleFunNames({ name: "Tyler W", role: "dev" })).toBe(false);
    expect(canToggleFunNames({ name: "Sam", role: "qa" })).toBe(false);
    expect(canToggleFunNames(null)).toBe(false);
  });
});
