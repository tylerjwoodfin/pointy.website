import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePointingBlackjack } from "./PointingBlackjackProvider";
import { sessionPath } from "./paths";

export const PointingBlackjackLobby: React.FC = () => {
  const { createSession, state, lastError, connectionStatus } =
    usePointingBlackjack();
  const navigate = useNavigate();
  const [startName, setStartName] = useState("");

  useEffect(() => {
    if (state?.sessionId && !state.gameOver) {
      navigate(sessionPath(state.sessionId), { replace: true });
    }
  }, [state, navigate]);

  const onStart = (e: React.FormEvent) => {
    e.preventDefault();
    createSession(startName);
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

      {lastError ? <p className="pb-error">{lastError}</p> : null}
    </div>
  );
};
