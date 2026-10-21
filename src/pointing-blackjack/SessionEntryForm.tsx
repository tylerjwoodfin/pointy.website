import React, { useState } from "react";
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
};

type SessionEntryFormProps = {
  busy: boolean;
  buttons: RoleButtonSpec[];
  onSubmit: (args: SessionEntrySubmit) => void;
};

export const SessionEntryForm: React.FC<SessionEntryFormProps> = ({
  busy,
  buttons,
  onSubmit,
}) => {
  const [draftName, setDraftName] = useState("");
  const nameReady = Boolean(draftName.trim());
  const disableActions = busy || !nameReady;

  const pickRole = (role: PlayerRole) => {
    if (disableActions) return;
    const name = draftName.trim();
    if (!name) return;
    onSubmit({ role, name });
  };

  return (
    <div className="pb-join-options">
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
