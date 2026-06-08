import "server-only";

import { normalizeGroupTag } from "@/lib/group";

// Server-side only — shipping this client-side would hand abusers a
// ready-made evasion dictionary. Entries are post-fold forms (the check runs
// on tagNorm), so leetspeak variants like "M0D5" are caught by the fold, not
// by enumeration here.
const RESERVED_GROUP_TAGS = new Set([
  // Authority / impersonation
  "ADMN",
  "MODS",
  "STAF",
  "OFCL",
  "TEAM",
  "HELP",
  "SUPP",
  "ROOT",
  "NULL",
  // Brand
  "UMAM",
  "UMMN",
  "PLUS",
  // Route segments under /groups/
  "JOIN",
  // Profanity / slurs
  "FUCK",
  "SHIT",
  "CUNT",
  "KUNT",
  "DICK",
  "COCK",
  "TWAT",
  "SLUT",
  "RAPE",
  "NAZI",
  "KIKE",
  "SPIC",
  "COON",
  "DYKE",
  "FAGS",
  "GOOK",
  "PAKI",
]);

export function isReservedGroupTag(tag: string): boolean {
  return RESERVED_GROUP_TAGS.has(normalizeGroupTag(tag));
}
