/**
 * A conversation is identified by its two user ids in sorted order, so either
 * participant derives the same id and nobody can name a conversation they are
 * not part of. Side 0 is the lower id, side 1 the higher.
 */

export type DmSide = 0 | 1;

export interface DmPair {
  lowId: string;
  highId: string;
  threadId: string;
}

export function dmPair(a: string, b: string): DmPair {
  const [lowId, highId] = a < b ? [a, b] : [b, a];
  return { lowId, highId, threadId: `${lowId}:${highId}` };
}

export function parseThreadId(threadId: string): DmPair | null {
  const parts = threadId.split(":");
  if (parts.length !== 2) return null;
  const [lowId, highId] = parts;
  if (!lowId || !highId || lowId >= highId) return null;
  return { lowId, highId, threadId };
}

export function sideOf(pair: DmPair, userId: string): DmSide | null {
  if (userId === pair.lowId) return 0;
  if (userId === pair.highId) return 1;
  return null;
}

export function userAt(pair: DmPair, side: DmSide): string {
  return side === 0 ? pair.lowId : pair.highId;
}

export function otherDmSide(side: DmSide): DmSide {
  return side === 0 ? 1 : 0;
}

/** The Durable Object name. Versioned so a breaking storage change can start
 *  fresh objects instead of migrating old ones. */
export function dmRoomName(threadId: string): string {
  return `dm:v1:${threadId}`;
}
