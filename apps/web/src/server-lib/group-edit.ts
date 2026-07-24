import type { Db } from "./db";

// group-edit throttle (2 edits/day) — plan port note: the Workers Rate Limiting
// binding can only express a 10s|60s period, so the old `group-edit` limiter
// (2/day) moves to Turso edit-window columns on the group row, checked here.
//
// TODO(migration): the columns this needs — `group.edit_count` +
// `group.edit_window_started_at` (a rolling 24h window) — DO NOT EXIST yet, and
// packages/db is off-limits for this workstream (the migration lands
// separately). The group row has only `updatedAt` ($onUpdate), which a single
// timestamp can't turn into a "2 per rolling day" counter. So this is a
// deliberate STUB that ALLOWS every edit; when the migration lands, replace the
// body with: read (edit_count, edit_window_started_at); if the window is older
// than 24h reset it to now/0; allow when edit_count < GROUP_EDIT_DAILY_CAP;
// increment on allow. Keep the signature stable so updateGroupAction is untouched.
export const GROUP_EDIT_DAILY_CAP = 2;

export const GROUP_EDIT_RATE_LIMITED_ERROR =
  "You can only edit a group twice a day. Try again later.";

/**
 * Returns whether this owner may edit `groupId` right now. STUB: always allows
 * (see TODO above). Signature is final so the migration is a body-only change.
 */
export async function checkGroupEditWindow(
  _db: Db,
  _groupId: string,
): Promise<{ allowed: boolean }> {
  return { allowed: true };
}
