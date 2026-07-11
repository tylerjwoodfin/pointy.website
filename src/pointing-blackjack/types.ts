export type VoteValue = 1 | 2 | 3 | 5 | 8 | 13;

export type SerializedVote = number | null | "hidden";

export type PlayerRole = "product" | "qa" | "dev";

export type PlayerRow = {
  id: string;
  name: string;
  online: boolean;
  role?: PlayerRole;
  /** Away / be right back — own row shows red status; missed votes show BRB instead of a frown. */
  brb?: boolean;
};

export type SessionState = {
  sessionId: string;
  myPlayerId: string;
  revealed: boolean;
  gameOver: boolean;
  /** Unix ms when the server drops this table (2 hours after creation). */
  expiresAt: number;
  players: PlayerRow[];
  voteByPlayer: Record<string, SerializedVote>;
};
