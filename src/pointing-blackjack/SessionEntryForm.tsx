import React, { useState } from "react";
import { uniqueCodename } from "./codename";
import type { PlayerRole } from "./types";

export type RoleButtonSpec = {
  role: PlayerRole;
  label: string;
  primary?: boolean;
};

export const LOBBY_START_BUTTONS: RoleButtonSpec[] = [
  { role: "dev", label: "I'm a Dev" },
  { role: "product", label: "I'm a Product Owner", primary: true },
  { role: "qa", label: "I'm a QA Engineer" },
];

export const MISSING_START_BUTTONS: RoleButtonSpec[] = [
  { role: "dev", label: "Start as Dev" },
  { role: "product", label: "Start as Product", primary: true },
  { role: "qa", label: "Start as QA" },
];

export const JOIN_BUTTONS: RoleButtonSpec[] = [
  { role: "dev", label: "Join as Dev", primary: true },
  { role: "qa", label: "Join as QA" },
  { role: "product", label: "Join as Product" },
];

export type SessionEntrySubmit = {
  role: PlayerRole;
  name: string;
  anonymousMode: boolean;
};

type SessionEntryFormProps = {
  busy: boolean;
  buttons: RoleButtonSpec[];
  /**
   * When set, this is a join (or resume) of an existing session: the checkbox
   * is hidden and name generation follows the session's anonymous mode.
   */
  lockedAnonymousMode?: boolean;
  existingNames?: readonly string[];
  onSubmit: (args: SessionEntrySubmit) => void;
};

export const SessionEntryForm: React.FC<SessionEntryFormProps> = ({
  busy,
  buttons,
  lockedAnonymousMode,
  existingNames = [],
  onSubmit,
}) => {
  const showToggle = lockedAnonymousMode === undefined;
  const [draftAnonymous, setDraftAnonymous] = useState(false);
  const [draftName, setDraftName] = useState("");
  const anonymousMode = showToggle ? draftAnonymous : lockedAnonymousMode;
  const needName = !anonymousMode;
  const nameReady = !needName || Boolean(draftName.trim());
  const disableActions = busy || !nameReady;

  const pickRole = (role: PlayerRole) => {
    if (disableActions) return;
    const name = anonymousMode
      ? uniqueCodename(existingNames)
      : draftName.trim();
    if (!name) return;
    onSubmit({ role, name, anonymousMode });
  };

  return (
    <div className="pb-join-options">
      {showToggle ? (
        <div>
          <label className="pb-check">
            <input
              type="checkbox"
              checked={draftAnonymous}
              onChange={(e) => setDraftAnonymous(e.target.checked)}
            />
            Anonymous Mode
          </label>
          <p className="pb-check__hint">
            Players join with generated nicknames instead of entering a name.
          </p>
        </div>
      ) : null}

      {needName ? (
        <label className="pb-label">
          Your name
          <input
            className="pb-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={40}
            autoComplete="nickname"
            autoFocus
            required
          />
        </label>
      ) : null}

      <div className="pb-join-options__buttons">
        {buttons.map((btn) => (
          <button
            key={btn.role}
            type="button"
            className={`pb-button ${btn.primary ? "pb-button--primary" : "pb-button--ghost"}`}
            disabled={disableActions}
            onClick={() => pickRole(btn.role)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
};
