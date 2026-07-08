import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faLink } from "@fortawesome/free-solid-svg-icons";
import { POINT_VALUES, cardLabel, formatVoteDisplay } from "./cards";
import { FrequencyBars } from "./FrequencyBars";
import {
  readStoredIdentity,
  usePointingBlackjack,
} from "./PointingBlackjackProvider";
import { isValidRoomCode } from "./roomCode";
import { PointingShowdownFeedbackModal } from "./PointingShowdownFeedbackModal";
import { uniqueCodename } from "./codename";
import type { PlayerRole, PlayerRow, VoteValue } from "./types";

type RoomPhase = "loading" | "unreachable" | "invalid" | "missing" | "exists";

function buildCounts(
  voteByPlayer: Record<string, number | null | "hidden">,
  playerIds: string[]
): Record<VoteValue, number> {
  const out: Record<VoteValue, number> = {
    1: 0,
    2: 0,
    3: 0,
    5: 0,
    8: 0,
    13: 0,
  };
  for (const pid of playerIds) {
    const v = voteByPlayer[pid];
    if (typeof v === "number" && (POINT_VALUES as readonly number[]).includes(v)) {
      out[v as VoteValue] += 1;
    }
  }
  return out;
}

/** Clipboard API requires a secure context (HTTPS or localhost); use fallbacks on LAN HTTP. */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // continue to fallbacks
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Whether this player has submitted a vote (values stay hidden until reveal). */
function hasSubmittedVote(
  vote: number | null | "hidden" | undefined
): boolean {
  return vote === "hidden" || typeof vote === "number";
}

function averageVote(
  voteByPlayer: Record<string, number | null | "hidden">,
  playerIds: string[]
): number | null {
  const nums: number[] = [];
  for (const pid of playerIds) {
    const v = voteByPlayer[pid];
    if (typeof v === "number") nums.push(v);
  }
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const VoteCardGrid: React.FC<{
  myNumeric: number | undefined;
  vote: (value: number) => void;
  clearVote: () => void;
}> = ({ myNumeric, vote, clearVote }) => (
  <div className="pb-card-grid">
    {POINT_VALUES.map((v) => {
      const { main, sub } = cardLabel(v);
      const selected = myNumeric === v;
      return (
        <button
          key={v}
          type="button"
          className={`pb-card ${selected ? "pb-card--selected" : ""}`}
          onClick={() => {
            if (selected) clearVote();
            else vote(v);
          }}
        >
          <span className="pb-card__corner">{main}</span>
          {sub ? <span className="pb-card__sub">{sub}</span> : null}
        </button>
      );
    })}
  </div>
);

function PlayerStatusDot({ online, brb }: { online: boolean; brb?: boolean }) {
  const kind = brb ? "brb" : online ? "on" : "off";
  const title =
    brb ? "Be right back" : online ? "Online" : "Offline";
  return (
    <span
      className={`pb-dot pb-dot--${kind}`}
      title={title}
      aria-hidden
    />
  );
}

function RoleFlair({ role }: { role?: PlayerRole }) {
  if (role === "qa") {
    return (
      <span className="pb-flair pb-flair--qa" aria-label="QA">
        QA
      </span>
    );
  }
  if (role === "dev") {
    return (
      <span className="pb-flair pb-flair--dev" aria-label="Dev">
        Dev
      </span>
    );
  }
  return null;
}

function PlayerNameCell({ player, brb }: { player: PlayerRow; brb?: boolean }) {
  return (
    <span className="pb-player-line">
      <PlayerStatusDot online={player.online} brb={brb} />
      <span className="pb-player-line__name">{player.name}</span>
      <span className="pb-player-line__flair">
        <RoleFlair role={player.role} />
      </span>
      {brb ? (
        <span className="pb-brb-suffix" aria-label="Be right back">
          - BRB
        </span>
      ) : null}
    </span>
  );
}

function YouCard({
  name,
  role,
  onSave,
}: {
  name: string;
  role?: PlayerRole;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onSave(trimmed);
    else setDraft(name);
  };

  return (
    <section className="pb-panel pb-you">
      <h2>You</h2>
      <label className="pb-label pb-you__label">
        <div className="pb-you__row">
          <input
            className="pb-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
                (e.target as HTMLInputElement).blur();
              }
            }}
            maxLength={40}
            autoComplete="nickname"
          />
          <RoleFlair role={role} />
        </div>
      </label>
    </section>
  );
}

export const PointingBlackjackSession: React.FC = () => {
  const { sessionId: paramId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const {
    state,
    lastError,
    joinSession,
    createSession,
    querySessionExists,
    clearLastError,
    vote,
    clearVote,
    reveal,
    newRound,
    leaveTable,
    setBrb,
    updateName,
    connectionStatus,
  } = usePointingBlackjack();

  const [joinName, setJoinName] = useState("");
  const [productJoinSelected, setProductJoinSelected] = useState(false);
  const productNameInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const autoJoinTried = useRef(false);
  const [roomPhase, setRoomPhase] = useState<RoomPhase>("loading");
  /** Bumps the room probe when the user retries after a connection failure. */
  const [probeNonce, setProbeNonce] = useState(0);
  const [sessionPlayerNames, setSessionPlayerNames] = useState<string[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const retryRoomProbe = useCallback(() => {
    leaveTable();
    setProbeNonce((n) => n + 1);
  }, [leaveTable]);

  const sessionUrl = useMemo(() => {
    if (!paramId) return "";
    return `${window.location.origin}/pointing-showdown/${paramId}`;
  }, [paramId]);

  const copyLink = useCallback(() => {
    if (!sessionUrl) return;
    void (async () => {
      const ok = await copyTextToClipboard(sessionUrl);
      if (ok) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } else {
        window.prompt("Copy this invite link:", sessionUrl);
      }
    })();
  }, [sessionUrl]);

  useEffect(() => {
    autoJoinTried.current = false;
    setProductJoinSelected(false);
  }, [paramId]);

  useEffect(() => {
    if (!productJoinSelected) return;
    productNameInputRef.current?.focus();
  }, [productJoinSelected]);

  useEffect(() => {
    if (!paramId) return;
    if (state?.sessionId === paramId) return;
    let cancelled = false;
    if (!isValidRoomCode(paramId)) {
      return;
    }
    setRoomPhase("loading");
    setSessionPlayerNames([]);
    void querySessionExists(paramId).then((r) => {
      if (cancelled) return;
      if (stateRef.current?.sessionId === paramId) return;
      if (r.unreachable) setRoomPhase("unreachable");
      else if (r.invalid) setRoomPhase("invalid");
      else if (r.exists) {
        setSessionPlayerNames(r.playerNames ?? []);
        setRoomPhase("exists");
      } else setRoomPhase("missing");
    });
    return () => {
      cancelled = true;
    };
  }, [paramId, querySessionExists, state?.sessionId, probeNonce]);

  useEffect(() => {
    if (!paramId) return;
    if (state?.sessionId === paramId) {
      autoJoinTried.current = true;
      return;
    }
    if (autoJoinTried.current) return;
    if (roomPhase !== "exists") return;
    const stored = readStoredIdentity(paramId);
    if (stored) {
      autoJoinTried.current = true;
      joinSession(paramId, stored.name, { playerId: stored.playerId });
    }
  }, [paramId, joinSession, state?.sessionId, roomPhase]);

  useEffect(() => {
    if (lastError !== "Session not found") return;
    if (roomPhase !== "exists") return;
    setRoomPhase("missing");
    clearLastError();
  }, [lastError, roomPhase, clearLastError]);

  const selectProductJoin = useCallback(() => {
    setProductJoinSelected(true);
  }, []);

  const confirmProductJoin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!paramId || !joinName.trim()) return;
      autoJoinTried.current = true;
      joinSession(paramId, joinName, { role: "product" });
    },
    [paramId, joinName, joinSession]
  );

  const joinAsQa = useCallback(() => {
    if (!paramId) return;
    autoJoinTried.current = true;
    joinSession(paramId, uniqueCodename(sessionPlayerNames), { role: "qa" });
  }, [paramId, joinSession, sessionPlayerNames]);

  const joinAsDev = useCallback(() => {
    if (!paramId) return;
    autoJoinTried.current = true;
    joinSession(paramId, uniqueCodename(sessionPlayerNames), { role: "dev" });
  }, [paramId, joinSession, sessionPlayerNames]);

  const onStartTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paramId) return;
    createSession(joinName, paramId);
  };

  const onLeave = () => {
    if (paramId) {
      sessionStorage.removeItem(`pointingBlackjack:${paramId}`);
    }
    leaveTable();
    navigate("/pointing-showdown");
  };

  const invalidRoomLinkSection = (
    <div className="pb-session">
      <section className="pb-panel">
        <h2>Invalid room link</h2>
        <p className="pb-muted">
          The piece of the URL after <code className="pb-code">/pointing-showdown/</code> must
          be a room code: 4–64 characters, only letters, numbers, dashes, and underscores (no
          spaces, dots, or slashes).
        </p>
        <button type="button" className="pb-button pb-button--primary" onClick={onLeave}>
          Back to lobby
        </button>
      </section>
    </div>
  );

  if (!paramId) {
    return <p className="pb-error">Missing session.</p>;
  }

  /** Bad code shape: never open a socket or show “can’t reach server”. */
  if (!isValidRoomCode(paramId)) {
    return invalidRoomLinkSection;
  }

  const showGameOver = state?.gameOver;

  if (!state && !showGameOver) {
    if (roomPhase === "loading") {
      return (
        <div className="pb-session pb-session--loading">
          <p>Checking room…</p>
        </div>
      );
    }

    if (roomPhase === "unreachable") {
      return (
        <div className="pb-session">
          <section className="pb-panel">
            <h2>Couldn&apos;t load this room</h2>
            <p className="pb-muted">
              First, check the address: the room code must be 4–64 characters (letters, numbers,
              dashes, underscores). Typos, extra segments, or pasted page URLs often look fine
              but aren&apos;t a real table link.
            </p>
            <p className="pb-muted">
              If the link is right, the app couldn&apos;t open the live WebSocket (
              <code className="pb-code">/pointing-showdown-ws</code>). For local dev, run{" "}
              <code className="pb-code">npm run dev:blackjack</code>, or{" "}
              <code className="pb-code">npm start</code> and{" "}
              <code className="pb-code">npm run server:blackjack</code> in two terminals.
            </p>
            <div className="pb-card-actions">
              <button
                type="button"
                className="pb-button pb-button--primary"
                onClick={retryRoomProbe}
              >
                Try again
              </button>
              <button type="button" className="pb-button pb-button--ghost" onClick={onLeave}>
                Back to lobby
              </button>
            </div>
          </section>
        </div>
      );
    }

    if (roomPhase === "invalid") {
      return invalidRoomLinkSection;
    }

    if (roomPhase === "missing") {
      return (
        <div className="pb-session">
          <section className="pb-panel">
            <h2>No table here yet</h2>
            <p className="pb-muted">
              Room <strong className="pb-code">{paramId}</strong> isn&apos;t active. You can
              start it and keep this exact link.
            </p>
          <form onSubmit={onStartTable} className="pb-form">
            <label className="pb-label">
              Your name (Product)
              <input
                className="pb-input"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Product owner"
                maxLength={40}
                autoComplete="nickname"
                autoFocus
              />
            </label>
              <button
                type="submit"
                className="pb-button pb-button--primary"
                disabled={!joinName.trim() || connectionStatus === "connecting"}
              >
                Start it
              </button>
            </form>
            {lastError ? <p className="pb-error">{lastError}</p> : null}
          </section>
        </div>
      );
    }

    const stored = readStoredIdentity(paramId);
    if (stored && !lastError) {
      return (
        <div className="pb-session pb-session--loading">
          <p>Connecting…</p>
        </div>
      );
    }

    return (
      <div className="pb-session">
        <section className="pb-panel">
          <h2>Join this table</h2>
          <p className="pb-muted">
            Room <strong className="pb-code">{paramId}</strong>
          </p>
          <div className="pb-join-options">
            <div className="pb-join-options__buttons">
              <button
                type="button"
                className={`pb-button ${productJoinSelected ? "pb-button--primary" : "pb-button--ghost"}`}
                disabled={connectionStatus === "connecting"}
                onClick={selectProductJoin}
              >
                Join as Product
              </button>
              <button
                type="button"
                className="pb-button pb-button--ghost"
                disabled={connectionStatus === "connecting"}
                onClick={joinAsQa}
              >
                Join as QA
              </button>
              <button
                type="button"
                className="pb-button pb-button--ghost"
                disabled={connectionStatus === "connecting"}
                onClick={joinAsDev}
              >
                Join as Dev
              </button>
            </div>
            <div
              className={`pb-join-product-name${productJoinSelected ? " pb-join-product-name--open" : ""}`}
              aria-hidden={!productJoinSelected}
            >
              <form onSubmit={confirmProductJoin} className="pb-join-product-name__inner pb-form">
                <label className="pb-label">
                  Your name
                  <input
                    ref={productNameInputRef}
                    className="pb-input"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Product owner"
                    maxLength={40}
                    autoComplete="nickname"
                    tabIndex={productJoinSelected ? 0 : -1}
                  />
                </label>
                <button
                  type="submit"
                  className="pb-button pb-button--primary"
                  disabled={!joinName.trim() || connectionStatus === "connecting"}
                >
                  Join table
                </button>
              </form>
            </div>
          </div>
          {lastError ? <p className="pb-error">{lastError}</p> : null}
        </section>
      </div>
    );
  }

  if (!state) {
    return null;
  }

  if (state.gameOver) {
    return (
      <div className="pb-session">
        <div className="pb-game-over" role="status">
          <h2>Table closed</h2>
          <p className="pb-muted">
            This session ends 60 minutes after it starts. Start a new one from the lobby anytime.
          </p>
          <div className="pb-card-actions">
            <button type="button" className="pb-button pb-button--primary" onClick={onLeave}>
              Back to lobby
            </button>
            <button
              type="button"
              className="pb-button pb-button--ghost"
              onClick={() => setFeedbackOpen(true)}
            >
              Feedback
            </button>
          </div>
        </div>
        <PointingShowdownFeedbackModal
          isOpen={feedbackOpen}
          sessionId={state.sessionId}
          playerName={state.players.find((p) => p.id === state.myPlayerId)?.name}
          onClose={() => setFeedbackOpen(false)}
        />
      </div>
    );
  }

  const myVote = state.voteByPlayer[state.myPlayerId];
  const myNumeric =
    typeof myVote === "number"
      ? myVote
      : undefined;

  const playerIds = state.players.map((p) => p.id);
  const counts = buildCounts(state.voteByPlayer, playerIds);
  const avg = averageVote(state.voteByPlayer, playerIds);

  const myPlayer = state.players.find((p) => p.id === state.myPlayerId);
  const myBrb = myPlayer?.brb === true;
  const productPlayers = state.players.filter((p) => p.role === "product");
  const teamPlayers = state.players.filter((p) => p.role !== "product");

  const renderVoteTableBody = (players: PlayerRow[]) =>
    players.map((p) => {
      const voted = hasSubmittedVote(state.voteByPlayer[p.id]);
      const brb = p.brb === true;
      return (
        <tr key={p.id}>
          <td>
            <PlayerNameCell player={p} brb={brb} />
          </td>
          <td
            aria-label={
              voted
                ? "Has voted; value hidden until reveal"
                : brb
                  ? "Be right back"
                  : "Waiting to vote"
            }
          >
            {voted ? (
              <span className="pb-table__vote pb-table__vote--yes">
                Voted
                <span className="pb-table__vote-hint" aria-hidden>
                  {" "}
                  · face down
                </span>
              </span>
            ) : brb ? (
              <span className="pb-table__vote pb-table__vote--brb">BRB</span>
            ) : (
              <span className="pb-table__vote pb-table__vote--no">Waiting</span>
            )}
          </td>
        </tr>
      );
    });

  const renderVoteList = (players: PlayerRow[]) =>
    players.map((p) => {
      const v = state.voteByPlayer[p.id];
      const has = typeof v === "number";
      const brb = p.brb === true;
      return (
        <li key={p.id} className="pb-vote-row">
          <span className="pb-player-line pb-vote-row__name">
            <PlayerStatusDot online={p.online} brb={brb} />
            <span className="pb-player-line__name">{p.name}</span>
            <span className="pb-player-line__flair">
              <RoleFlair role={p.role} />
            </span>
            {brb ? (
              <span className="pb-brb-suffix" aria-label="Be right back">
                - BRB
              </span>
            ) : null}
          </span>
          <span className="pb-vote-row__val">
            {has ? (
              formatVoteDisplay(v, true)
            ) : brb ? (
              <span className="pb-vote-brb-label">BRB</span>
            ) : (
              <>
                <span className="pb-frown" aria-hidden>
                  ☹️
                </span>{" "}
                no vote
              </>
            )}
          </span>
        </li>
      );
    });

  const renderProductTableBody = (players: PlayerRow[]) =>
    players.map((p) => {
      const brb = p.brb === true;
      return (
        <tr key={p.id}>
          <td>
            <PlayerNameCell player={p} brb={brb} />
          </td>
        </tr>
      );
    });

  const renderProductList = (players: PlayerRow[]) =>
    players.map((p) => {
      const brb = p.brb === true;
      return (
        <li key={p.id} className="pb-product-row">
          <PlayerStatusDot online={p.online} brb={brb} />
          {p.name}
          {brb ? (
            <span className="pb-brb-suffix" aria-label="Be right back">
              {" "}
              - BRB
            </span>
          ) : null}
        </li>
      );
    });

  return (
    <div className="pb-session">
      <>
        <div className="pb-session__toolbar">
          <div className="pb-session__room">
            <span className="pb-muted">Room:</span>
            <code className="pb-code">{state.sessionId}</code>
            <button
              type="button"
              className={`pb-session__copy-link${copied ? " pb-session__copy-link--copied" : ""}`}
              onClick={copyLink}
              aria-label={copied ? "Invite link copied" : "Copy invite link"}
              title={copied ? "Copied!" : "Copy invite link"}
            >
              <FontAwesomeIcon icon={copied ? faCheck : faLink} />
            </button>
            {connectionStatus !== "open" ? (
              <span className="pb-session__connection" role="status">
                {connectionStatus === "connecting" ? "Reconnecting…" : "Disconnected"}
              </span>
            ) : null}
          </div>
          <div className="pb-session__actions">
            <button
              type="button"
              className={`pb-button pb-button--ghost ${myBrb ? "pb-button--brb-active" : ""}`}
              onClick={() => setBrb(!myBrb)}
            >
              {myBrb ? "I'm back" : "BRB"}
            </button>
            <button
              type="button"
              className="pb-button pb-button--ghost"
              onClick={() => setFeedbackOpen(true)}
            >
              Feedback
            </button>
            <button type="button" className="pb-button pb-button--ghost" onClick={onLeave}>
              Leave table
            </button>
          </div>
        </div>

        {!state.revealed ? (
          <div className="pb-voting-layout">
            <div className="pb-voting-layout__sidebar">
              {myPlayer ? (
                <YouCard
                  name={myPlayer.name}
                  role={myPlayer.role}
                  onSave={updateName}
                />
              ) : null}

              <section className="pb-panel pb-players">
                <h2>Players</h2>
                <p className="pb-muted pb-players__hint">
                  Points stay secret until someone reveals the cards.
                </p>
                <div className="pb-table-wrap">
                  <table className="pb-table">
                    <thead>
                      <tr>
                        <th scope="col">Player</th>
                        <th scope="col">Vote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPlayers.length > 0 ? (
                        renderVoteTableBody(teamPlayers)
                      ) : (
                        <tr>
                          <td colSpan={2} className="pb-muted">
                            No QA or Dev players yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {productPlayers.length > 0 ? (
                <section className="pb-panel pb-product">
                  <h2>Dealers</h2>
                  <div className="pb-table-wrap">
                    <table className="pb-table pb-table--product">
                      <thead>
                        <tr>
                          <th scope="col">Player</th>
                        </tr>
                      </thead>
                      <tbody>{renderProductTableBody(productPlayers)}</tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>

            <section className="pb-panel pb-voting-layout__cards">
              <VoteCardGrid myNumeric={myNumeric} vote={vote} clearVote={clearVote} />
            </section>

            <div className="pb-voting-layout__actions pb-card-actions">
              <button
                type="button"
                className="pb-button pb-button--accent"
                onClick={reveal}
              >
                Reveal cards
              </button>
            </div>
          </div>
        ) : (
          <section className="pb-panel pb-revealed">
            <div className="pb-revealed__actions">
              <button type="button" className="pb-button pb-button--primary" onClick={newRound}>
                Next round
              </button>
            </div>
            <div className="pb-revealed-layout">
              <div className="pb-revealed-layout__aside">
                <FrequencyBars counts={counts} />
                <div className="pb-avg-column">
                  <h3>Average</h3>
                  {avg !== null ? (
                    <p className="pb-avg-value">{avg.toFixed(2)}</p>
                  ) : (
                    <p className="pb-muted">No votes yet.</p>
                  )}
                  <p className="pb-muted pb-avg-note">Non-voters excluded.</p>
                </div>
                <div className="pb-votes-column">
                  <h3>Players</h3>
                  <ul className="pb-vote-list">
                    {teamPlayers.length > 0 ? (
                      renderVoteList(teamPlayers)
                    ) : (
                      <li className="pb-muted">No QA or Dev players yet.</li>
                    )}
                  </ul>
                </div>
                {productPlayers.length > 0 ? (
                  <div className="pb-votes-column pb-product">
                    <h3>Dealers</h3>
                    <ul className="pb-product-list">{renderProductList(productPlayers)}</ul>
                  </div>
                ) : null}
              </div>
              <section className="pb-panel pb-revealed-layout__cards">
                <VoteCardGrid myNumeric={myNumeric} vote={vote} clearVote={clearVote} />
              </section>
            </div>
          </section>
        )}
      </>
      <PointingShowdownFeedbackModal
        isOpen={feedbackOpen}
        sessionId={state.sessionId}
        playerName={myPlayer?.name}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  );
};
