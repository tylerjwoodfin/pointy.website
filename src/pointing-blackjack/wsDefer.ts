/**
 * Firefox (and some dev-server timing) can abort WebSockets created while the document is
 * still loading ("interrupted while the page was loading"). Wait for load first.
 */
export function whenWsConnectAllowed(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }
  if (document.readyState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}
