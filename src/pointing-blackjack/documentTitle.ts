export const POINTING_SHOWDOWN_TITLE = "Pointing Showdown";

export function swapDocumentTitle(nextTitle: string): () => void {
  const previousTitle = document.title;
  document.title = nextTitle;
  return () => {
    document.title = previousTitle;
  };
}
