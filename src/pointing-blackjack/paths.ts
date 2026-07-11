/** Lobby and session paths — root is canonical; /pointing-showdown kept for legacy links. */
export function lobbyPath(pathname: string): string {
  return pathname.startsWith("/pointing-showdown") ? "/pointing-showdown" : "/";
}

export function sessionPath(pathname: string, sessionId: string): string {
  const base = lobbyPath(pathname).replace(/\/$/, "");
  return base ? `${base}/${sessionId}` : `/${sessionId}`;
}

export function inLiveSession(pathname: string): boolean {
  const segs = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segs[0] === "pointing-showdown") {
    return segs.length >= 2;
  }
  return segs.length >= 1;
}
