import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchActiveSessions,
  type ActiveSessionSummary,
} from "./fetchActiveSessions";
import { usePointingBlackjack } from "./PointingBlackjackProvider";

export const PointingBlackjackLobby: React.FC = () => {
  const {
    createSession,
    joinSession,
    leaveTable,
    state,
    lastError,
    connectionStatus,
  } = usePointingBlackjack();
  const navigate = useNavigate();
  const [startName, setStartName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [activeSessions, setActiveSessions] = useState<ActiveSessionSummary[]>(
    []
  );
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const list = await fetchActiveSessions();
      setActiveSessions(list);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    const interval = window.setInterval(() => void loadSessions(), 8000);
    const onVis = () => {
      if (!document.hidden) void loadSessions();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadSessions]);

  useEffect(() => {
    if (state?.sessionId && !state.gameOver) {
      navigate(`/pointing-showdown/${state.sessionId}`, { replace: true });
    }
  }, [state, navigate]);

  const onStart = (e: React.FormEvent) => {
    e.preventDefault();
    createSession(startName);
  };

  const onJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinCode.trim();
    const id = raw.includes("/") ? raw.split("/").filter(Boolean).pop() || raw : raw;
    if (state?.sessionId && state.sessionId !== id) {
      leaveTable();
    }
    joinSession(id, joinName);
  };

  const openSession = (sessionId: string) => {
    if (state?.sessionId && state.sessionId !== sessionId) {
      leaveTable();
    }
    navigate(`/pointing-showdown/${sessionId}`);
  };

  return (
    <div className="pb-lobby">
      <section className="pb-panel">
      <h2>Start a session</h2>
      <p className="pb-muted">You’ll get a link to share with your team.</p>
      <form onSubmit={onStart} className="pb-form">
        <label className="pb-label">
          Your name
          <input
            className="pb-input"
            value={startName}
            onChange={(e) => setStartName(e.target.value)}
            placeholder="Cam"
            maxLength={40}
            autoComplete="nickname"
          />
        </label>
        <button
          type="submit"
          className="pb-button pb-button--primary"
          disabled={!startName.trim() || connectionStatus === "connecting"}
        >
          Start a session
        </button>
      </form>
    </section>

      <section className="pb-panel pb-panel--sessions">
        <h2>Join a session</h2>
        {sessionsLoading && activeSessions.length === 0 ? (
          <p className="pb-muted pb-session-list__loading">Loading…</p>
        ) : activeSessions.length === 0 ? (
          <p className="pb-muted">No active sessions right now. Want to start one?</p>
        ) : (
          <ul className="pb-session-list">
            {activeSessions.map((s) => (
              <li key={s.sessionId}>
                <button
                  type="button"
                  className="pb-session-list__row"
                  onClick={() => openSession(s.sessionId)}
                >
                  <code className="pb-code">{s.sessionId}</code>
                  <span className="pb-session-list__count">
                    {s.playerCount} {s.playerCount === 1 ? "player" : "players"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="pb-button pb-button--ghost pb-session-list__refresh"
          onClick={() => void loadSessions()}
          disabled={sessionsLoading}
        >
          Refresh list
        </button>
      </section>

      {lastError ? <p className="pb-error">{lastError}</p> : null}
    </div>
  );
};
