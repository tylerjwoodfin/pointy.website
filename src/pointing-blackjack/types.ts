export type VoteValue = 1 | 2 | 3 | 5 | 8 | 13;

export type SerializedVote = number | null | "hidden";

export type PlayerRow = {
  id: string;
  name: string;
  online: boolean;
};

export type SessionState = {
  sessionId: string;
  myPlayerId: string;
  revealed: boolean;
  gameOver: boolean;
  /** Unix ms when the server drops this table (60 minutes after creation). */
  expiresAt: number;
  players: PlayerRow[];
  voteByPlayer: Record<string, SerializedVote>;
};
