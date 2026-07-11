import {
  POINTING_SHOWDOWN_TITLE,
  swapDocumentTitle,
} from "./documentTitle";

test("swaps the document title for Pointing Showdown and restores it", () => {
  document.title = "Tyler Woodfin";

  const restore = swapDocumentTitle(POINTING_SHOWDOWN_TITLE);

  expect(document.title).toBe("Pointing Showdown");

  restore();

  expect(document.title).toBe("Tyler Woodfin");
});
