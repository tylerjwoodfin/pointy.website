import { whenWsConnectAllowed } from "./wsDefer";
import { pointingBlackjackWsUrl } from "./wsUrl";

export type ActiveSessionSummary = {
  sessionId: string;
  playerCount: number;
};

export async function fetchActiveSessions(): Promise<ActiveSessionSummary[]> {
  await whenWsConnectAllowed();
  return new Promise((resolve) => {
    const ws = new WebSocket(pointingBlackjackWsUrl());
    const finish = (list: ActiveSessionSummary[]) => {
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve(list);
    };
    const timeout = window.setTimeout(() => finish([]), 6000);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "listSessions" }));
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as {
          type?: string;
          sessions?: ActiveSessionSummary[];
        };
        if (data.type === "sessionsList" && Array.isArray(data.sessions)) {
          finish(data.sessions);
        }
      } catch {
        finish([]);
      }
    };
    ws.onerror = () => finish([]);
  });
}
