import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { uniqueCodename } from "./codename";
import { usePointingBlackjack } from "./PointingBlackjackProvider";
import { sessionPath } from "./paths";
import type { PlayerRole } from "./types";

export const PointingBlackjackLobby: React.FC = () => {
  const { createSession, state, lastError, connectionStatus } =
    usePointingBlackjack();
  const navigate = useNavigate();

  useEffect(() => {
    if (state?.sessionId && !state.gameOver) {
      navigate(sessionPath(state.sessionId), { replace: true });
    }
  }, [state, navigate]);

  const startAs = (role: PlayerRole) => {
    createSession(uniqueCodename([]), { role });
  };

  const busy = connectionStatus === "connecting";

  return (
    <div className="pb-lobby">
      <section className="pb-panel">
        <h2>Start a session</h2>
        <p className="pb-muted">You’ll get a link to share with your team.</p>
        <div className="pb-join-options">
          <div className="pb-join-options__buttons">
            <button
              type="button"
              className="pb-button pb-button--ghost"
              disabled={busy}
              onClick={() => startAs("product")}
            >
              Start as Product
            </button>
            <button
              type="button"
              className="pb-button pb-button--ghost"
              disabled={busy}
              onClick={() => startAs("qa")}
            >
              Start as QA
            </button>
            <button
              type="button"
              className="pb-button pb-button--ghost"
              disabled={busy}
              onClick={() => startAs("dev")}
            >
              Start as Dev
            </button>
          </div>
        </div>
      </section>

      {lastError ? <p className="pb-error">{lastError}</p> : null}
    </div>
  );
};
