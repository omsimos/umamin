export const ALIAS_ADJECTIVES = [
  "Wandering",
  "Quiet",
  "Midnight",
  "Velvet",
  "Golden",
  "Electric",
  "Hidden",
  "Cosmic",
  "Gentle",
  "Restless",
  "Lucid",
  "Amber",
  "Silver",
  "Wild",
];
export const ALIAS_NOUNS = [
  "Fox",
  "Owl",
  "Comet",
  "Wolf",
  "Ember",
  "Otter",
  "Falcon",
  "Moth",
  "Heron",
  "Lynx",
  "Raven",
  "Koi",
  "Sparrow",
  "Bear",
];

type Rng = () => number;

function pick<T>(list: T[], random: Rng): T {
  return list[Math.floor(random() * list.length)];
}

export function randomAlias(random: Rng = Math.random): string {
  return `${pick(ALIAS_ADJECTIVES, random)}${pick(ALIAS_NOUNS, random)}`;
}

export function randomAvatarSeed(random: Rng = Math.random): string {
  return `${Math.floor(random() * 1e9).toString(36)}`;
}
