/**
 * Fun titles shown after a player's real name: "Bob the Sleepy Eagle".
 * Nouns are animals, mythical creatures, tech/corporate titles, and plants.
 */

export const ADJECTIVES = [
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
  "Sleepy",
  "Sparkly",
  "Grumpy",
  "Ancient",
  "Chaotic",
  "Modest",
  "Radiant",
  "Sneaky",
  "Loyal",
  "Breezy",
  "Curious",
  "Drowsy",
  "Fierce",
  "Giddy",
  "Hasty",
  "Lanky",
  "Mellow",
  "Noble",
  "Plucky",
  "Rowdy",
  "Shiny",
  "Stormy",
  "Sunny",
  "Cheerful",
  "Dusty",
  "Gloomy",
  "Lively",
  "Merry",
  "Peppy",
  "Quirky",
  "Snappy",
  "Sturdy",
  "Brisk",
  "Cozy",
  "Dizzy",
  "Fancy",
  "Humble",
  "Jumpy",
  "Lofty",
  "Moody",
  "Perky",
  "Rosy",
  "Spicy",
  "Toasty",
  "Upbeat",
  "Wild",
  "Zippy",
  "Bouncy",
  "Cranky",
  "Dreamy",
  "Feisty",
  "Goofy",
  "Misty",
  "Noisy",
  "Ornate",
  "Prickly",
  "Quiet",
  "Salty",
  "Thrifty",
  "Wobbly",
  "Zealous",
];

export const ANIMALS = [
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
  "Penguin",
  "Llama",
  "Hedgehog",
  "Raccoon",
  "Toucan",
  "Narwhal",
  "Alpaca",
  "Parrot",
  "Beaver",
  "Wombat",
];

export const MYTHICAL = [
  "Dragon",
  "Phoenix",
  "Griffin",
  "Unicorn",
  "Kraken",
  "Basilisk",
  "Hydra",
  "Sphinx",
  "Cerberus",
  "Pegasus",
  "Chimera",
  "Wyvern",
  "Goblin",
  "Titan",
  "Cyclops",
  "Minotaur",
  "Kelpie",
  "Banshee",
  "Valkyrie",
  "Djinn",
  "Yeti",
  "Nymph",
  "Fairy",
  "Mermaid",
  "Centaur",
  "Kitsune",
  "Gorgon",
  "Ifrit",
  "Selkie",
  "Wendigo",
];

export const TITLES = [
  "Architect",
  "Analyst",
  "Manager",
  "Director",
  "Intern",
  "Founder",
  "Consultant",
  "Engineer",
  "Designer",
  "Strategist",
  "Executive",
  "Operator",
  "Producer",
  "Recruiter",
  "Auditor",
  "Stakeholder",
  "Evangelist",
  "Scrum Master",
  "Product Owner",
  "Tech Lead",
  "Staff Engineer",
  "Vice President",
];

export const PLANTS = [
  "Fern",
  "Cactus",
  "Sequoia",
  "Bamboo",
  "Orchid",
  "Moss",
  "Ivy",
  "Maple",
  "Cedar",
  "Willow",
  "Palm",
  "Lotus",
  "Thistle",
  "Clover",
  "Daisy",
  "Poppy",
  "Redwood",
  "Magnolia",
  "Juniper",
  "Sage",
  "Pothos",
  "Ficus",
  "Aloe",
  "Dandelion",
  "Sunflower",
  "Lavender",
  "Spruce",
  "Birch",
  "Peony",
];

const NOUNS = [...ANIMALS, ...MYTHICAL, ...TITLES, ...PLANTS];

/**
 * @param {readonly string[]} items
 */
function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Unique "Adjective Noun" title, not already used in the session.
 * @param {readonly string[]} existingTitles
 */
export function uniqueFunTitle(existingTitles) {
  const taken = new Set(existingTitles.map((title) => String(title).toLowerCase()));
  /** @type {string[]} */
  const available = [];
  for (const adjective of ADJECTIVES) {
    for (const noun of NOUNS) {
      const title = `${adjective} ${noun}`;
      if (!taken.has(title.toLowerCase())) available.push(title);
    }
  }
  if (available.length > 0) return pickRandom(available);
  return `${pickRandom(ADJECTIVES)} ${pickRandom(NOUNS)} ${Math.floor(Math.random() * 90 + 10)}`;
}

/**
 * Fill in a stable fun title for any player who does not have one yet.
 * @param {{ players: Map<string, { funTitle?: string }> }} session
 */
export function ensureFunTitles(session) {
  for (const player of session.players.values()) {
    if (typeof player.funTitle === "string" && player.funTitle.trim()) {
      player.funTitle = player.funTitle.trim();
      continue;
    }
    /** @type {string[]} */
    const taken = [];
    for (const other of session.players.values()) {
      if (other.funTitle) taken.push(other.funTitle);
    }
    player.funTitle = uniqueFunTitle(taken);
  }
}

/**
 * Product (BA) or a player whose real name is Tyler.
 * @param {{ name?: string, role?: string } | null | undefined} player
 */
export function canToggleFunNames(player) {
  if (!player) return false;
  if (player.role === "product") return true;
  return String(player.name ?? "").trim().toLowerCase() === "tyler";
}
