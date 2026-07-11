import {
  POINTY_TITLE,
  swapDocumentTitle,
} from "./documentTitle";

test("swaps the document title for Pointy and restores it", () => {
  document.title = "Previous";

  const restore = swapDocumentTitle(POINTY_TITLE);
  expect(document.title).toBe("Pointy");

  restore();
  expect(document.title).toBe("Previous");
});
