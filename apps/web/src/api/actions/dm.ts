import * as z from "zod";
import { dmPair, dmRoomName } from "../../lib/dm/pair";
import { action } from "../../server-lib/action";
import { resolveDmPeer } from "../../server-lib/dm/access";
import { resolveDmReport } from "../../server-lib/dm/threads";
import { NOT_FOUND_ERROR } from "../../server-lib/errors";
import { isDmEnabled } from "../../server-lib/flags";
import { isModerator } from "../../server-lib/moderation";
import { idSchema } from "../../server-lib/schema";
import { formatUsername } from "../routes/_shared";
import { ctxDb } from "./_shared";

/** "Delete chat": hides the conversation from the viewer's side only. */
export const hideDmThreadHandler = action(
  {
    schema: z.object({ username: z.string().trim().min(1).max(40) }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `dm-hide:${session.userId}`,
    },
  },
  async ({ username }, { session, c }) => {
    if (!(await isDmEnabled(c.env))) return { error: NOT_FOUND_ERROR };
    const access = await resolveDmPeer(
      ctxDb(c),
      session.userId,
      formatUsername(username),
    );
    if (!access) return { error: NOT_FOUND_ERROR };
    const { threadId } = dmPair(session.userId, access.peer.id);
    await c.env.DM_ROOM.get(
      c.env.DM_ROOM.idFromName(dmRoomName(threadId)),
    ).hide(session.userId);
    return { success: true };
  },
);

/** Moderator: close a DM report. A ban goes through banUserAction first;
 *  this only records the outcome. */
export const resolveDmReportHandler = action(
  {
    schema: z.object({
      id: idSchema,
      resolution: z.enum(["dismissed", "actioned"]),
    }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `dm-report:${session.userId}`,
    },
  },
  async ({ id, resolution }, { user, c }) => {
    // Same generic answer for non-moderators and missing reports.
    if (!isModerator(user, c.env.MODERATOR_USERS)) {
      return { error: NOT_FOUND_ERROR };
    }
    const done = await resolveDmReport(ctxDb(c), id, user.id, resolution);
    return done ? { success: true } : { error: NOT_FOUND_ERROR };
  },
);
