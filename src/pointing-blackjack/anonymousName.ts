const FACE_EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😊",
  "🙂",
  "😉",
  "😌",
  "😎",
  "🤓",
  "🧐",
  "🤔",
  "😏",
  "😴",
  "🤗",
  "🤭",
  "🫡",
  "🫠",
] as const;

const FALLBACK_EMOJIS = ["🙃", "😶", "😮", "🥸", "😬", "🤐"] as const;

export const ANONYMOUS_PREFIX = "Anonymous ";

/** Extract the leading emoji from an anonymous display name, if any. */
export function parseAnonymousEmoji(name: string): string | null {
  if (!name.startsWith(ANONYMOUS_PREFIX)) return null;
  const rest = name.slice(ANONYMOUS_PREFIX.length).trim();
  const match = rest.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
  return match ? match[1] : null;
}

/** Pick a random anonymous name whose emoji is not already used in the session. */
export function uniqueAnonymousName(existingNames: readonly string[]): string {
  const taken = new Set<string>();
  for (const name of existingNames) {
    const emoji = parseAnonymousEmoji(name);
    if (emoji) taken.add(emoji);
  }

  const available = FACE_EMOJIS.filter((emoji) => !taken.has(emoji));
  if (available.length > 0) {
    const emoji = available[Math.floor(Math.random() * available.length)];
    return `${ANONYMOUS_PREFIX}${emoji}`;
  }

  const fallback = FALLBACK_EMOJIS.find((emoji) => !taken.has(emoji));
  if (fallback) return `${ANONYMOUS_PREFIX}${fallback}`;

  return `${ANONYMOUS_PREFIX}🎭`;
}
