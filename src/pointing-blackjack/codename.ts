const ADJECTIVES = [
  "Swift",
  "Clever",
  "Bold",
  "Calm",
  "Daring",
  "Eager",
  "Fuzzy",
  "Gentle",
  "Happy",
  "Jolly",
  "Keen",
  "Lucky",
  "Mighty",
  "Nimble",
  "Proud",
  "Quick",
  "Rusty",
  "Silent",
  "Tiny",
  "Witty",
  "Zesty",
  "Brave",
  "Cosmic",
  "Dapper",
  "Electric",
  "Frosty",
  "Golden",
  "Hidden",
  "Icy",
  "Jazzy",
] as const;

const ANIMALS = [
  "Fox",
  "Panda",
  "Eagle",
  "Otter",
  "Wolf",
  "Hawk",
  "Lynx",
  "Bear",
  "Crane",
  "Tiger",
  "Falcon",
  "Badger",
  "Heron",
  "Moose",
  "Raven",
  "Seal",
  "Viper",
  "Whale",
  "Bison",
  "Cobra",
  "Dolphin",
  "Gecko",
  "Ibis",
  "Jaguar",
  "Koala",
  "Lemur",
  "Mantis",
  "Newt",
  "Owl",
  "Quail",
] as const;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Build a unique "Adjective Animal" display name not already taken in the session. */
export function uniqueCodename(existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const combos: string[] = [];
  for (const adj of ADJECTIVES) {
    for (const animal of ANIMALS) {
      combos.push(`${adj} ${animal}`);
    }
  }
  const available = combos.filter((c) => !taken.has(c.toLowerCase()));
  if (available.length > 0) {
    return pickRandom(available);
  }
  return `${pickRandom(ADJECTIVES)} ${pickRandom(ANIMALS)} ${Math.floor(Math.random() * 90 + 10)}`;
}
