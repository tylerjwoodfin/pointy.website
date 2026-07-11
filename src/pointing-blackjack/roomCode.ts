/** Must match server rules in server/pointing-blackjack.mjs */
const ROOM_CODE = /^[a-zA-Z0-9_-]+$/;

export function isValidRoomCode(id: string): boolean {
  const s = id.trim();
  if (s.length < 4 || s.length > 64) return false;
  return ROOM_CODE.test(s);
}
