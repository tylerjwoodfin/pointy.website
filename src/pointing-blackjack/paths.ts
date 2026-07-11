/** Lobby and session paths (root-canonical). */
export function lobbyPath(): string {
  return "/";
}

export function sessionPath(sessionId: string): string {
  return `/${sessionId}`;
}

export function inLiveSession(pathname: string): boolean {
  const segs = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  return segs.length >= 1;
}
