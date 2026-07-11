export const POINTY_TITLE = "Pointy";

/** Swap `document.title` for the duration of a mount; restore on cleanup. */
export function swapDocumentTitle(title: string): () => void {
  const previous = document.title;
  document.title = title;
  return () => {
    document.title = previous;
  };
}
