import React, { useEffect, useRef, useState } from "react";

type ModalPhase = "form" | "submitting" | "thanks" | "error";

interface PointingShowdownFeedbackModalProps {
  isOpen: boolean;
  sessionId?: string;
  playerName?: string;
  onClose: () => void;
}

export const PointingShowdownFeedbackModal: React.FC<
  PointingShowdownFeedbackModalProps
> = ({ isOpen, sessionId, playerName, onClose }) => {
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<ModalPhase>("form");
  const [errorText, setErrorText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMessage("");
    setPhase("form");
    setErrorText("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "submitting") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, phase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 4) return;

    setPhase("submitting");
    setErrorText("");

    const meta: string[] = [];
    if (sessionId) meta.push(`[Room: ${sessionId}]`);
    if (playerName) meta.push(`[Player: ${playerName}]`);
    const fullMessage = meta.length ? `${meta.join("\n")}\n\n${trimmed}` : trimmed;

    try {
      const response = await fetch("/submit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: fullMessage,
          customSubject: "Pointing Showdown Feedback",
        }),
      });

      if (response.ok) {
        setPhase("thanks");
        window.setTimeout(onClose, 1500);
      } else {
        const text = await response.text();
        setErrorText(text || "Something went wrong. Please try again.");
        setPhase("error");
      }
    } catch {
      setErrorText("Could not reach the server. Please try again.");
      setPhase("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="pb-feedback-modal__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "submitting") onClose();
      }}
    >
      <div
        className="pb-feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pb-feedback-title"
      >
        <button
          type="button"
          className="pb-feedback-modal__close"
          onClick={onClose}
          disabled={phase === "submitting"}
          aria-label="Close"
        >
          ×
        </button>

        {phase === "thanks" ? (
          <p className="pb-feedback-modal__thanks" role="status">
            Thank you for your feedback
          </p>
        ) : (
          <>
            <h2 id="pb-feedback-title" className="pb-feedback-modal__title">
              Feedback
            </h2>
            <form className="pb-form" onSubmit={handleSubmit}>
              <label className="pb-label">
                <textarea
                  ref={textareaRef}
                  className="pb-input pb-feedback-modal__textarea"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your anonymous feedback..."
                  rows={5}
                  disabled={phase === "submitting"}
                  required
                  minLength={4}
                />
              </label>
              {phase === "error" && errorText ? (
                <p className="pb-error" role="alert">
                  {errorText}
                </p>
              ) : null}
              <button
                type="submit"
                className="pb-button pb-button--primary"
                disabled={message.trim().length < 4 || phase === "submitting"}
              >
                {phase === "submitting" ? "Sending…" : "Submit"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
