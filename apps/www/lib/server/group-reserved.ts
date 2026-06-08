import "server-only";

import { normalizeGroupTag } from "@/lib/group";

// Server-side only — shipping this client-side would hand abusers a
// ready-made evasion dictionary. Entries are stored in the post-fold form
// (the check runs on tagNorm), so leetspeak digit swaps like "M0D5" → "MODS"
// or "1488" → "IABB" are caught by the fold. The fold does NOT cover letter
// homoglyphs (Z↔S, V↔U, K↔C), so the notable letter-swap variants are listed
// explicitly below.
//
// This is intentionally NOT exhaustive — a 4-char namespace has endless
// permutations and slang shifts. It blocks the obvious impersonation/slur
// cases; the real backstop is user reporting + creator-accountable takedown
// (every group has a known creatorId).
const RESERVED_GROUP_TAGS = new Set([
  // Authority / impersonation — tags that could pass as platform staff.
  "ADMN",
  "MODS",
  "MODZ",
  "STAF",
  "OFCL",
  "TEAM",
  "HELP",
  "SUPP",
  "ROOT",
  "SUDO",
  "NULL",
  "VERI",
  "BOTS",
  // Brand.
  "UMAM",
  "UMMN",
  "PLUS",
  // Route segment under /groups/.
  "JOIN",
  // Strong profanity (+ letter-swap variants the digit fold misses).
  "FUCK",
  "FUKK",
  "FVCK",
  "SHIT",
  "DICK",
  "COCK",
  "CUNT",
  "KUNT",
  "TWAT",
  "SLUT",
  "WANK",
  "JIZZ",
  "TITS",
  "CLIT",
  // Slurs, hate codes, and abuse.
  "RAPE",
  "NAZI",
  "HEIL",
  "KKKK",
  "IABB", // folded "1488" (neo-nazi numeric code)
  "KIKE",
  "SPIC",
  "SPIK",
  "COON",
  "DYKE",
  "FAGS",
  "FAGZ",
  "GOOK",
  "GOON",
  "PAKI",
  "JAPS",
  "WOGS",
  "TARD",
  "NIGS",
  "NIGA",
  "NIGZ",
  "NIGR",
  "NIGG",
]);

export function isReservedGroupTag(tag: string): boolean {
  return RESERVED_GROUP_TAGS.has(normalizeGroupTag(tag));
}
