import { showNoVoteFrown } from "./showNoVoteFrown";

describe("showNoVoteFrown", () => {
  it("hides the no-vote frown for Product", () => {
    expect(showNoVoteFrown("product")).toBe(false);
  });

  it("shows the no-vote frown for Dev and QA", () => {
    expect(showNoVoteFrown("dev")).toBe(true);
    expect(showNoVoteFrown("qa")).toBe(true);
  });
});
