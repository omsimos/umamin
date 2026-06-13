import "server-only";

import { db } from "@umamin/db";
import type { NotificationType } from "@umamin/db/schema/notification";
import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { PUSH_CATEGORY } from "@/lib/push-prefs";

// web-push uses Node crypto (asn1.js/jws/http_ece) and CANNOT run on the Edge
// runtime — this module is server-only and dynamically imported from notify()
// (see notifications.ts) so its Node deps never bundle into an edge-eligible
// module. Keep every caller on the Node runtime.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:support@umamin.link";

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false; // unconfigured → no-op
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidReady = true;
  return true;
}

type CopyEntry = {
  category: number;
  // `actor` is the resolved "username" (without @) or null. Anonymous types
  // (message/reply) ignore it entirely — they must never reveal a sender.
  title: (actor: string | null) => string;
  // Deep-link target. Defaults to /notifications; never "/" (start_url is
  // /feed and PwaRedirect bounces "/").
  url: (targetId: string, actor: string | null) => string;
  // When true, never resolve or render an actor (sender anonymity).
  anonymous?: true;
};

// TOTAL map over every NotificationType — `Record<NotificationType, …>` makes
// adding a type to the union without copy a COMPILE error (CI runs check-types),
// which is the enforcement the plan calls for. Copy is type-derived only; the
// builder never reads message/comment CONTENT (AES-at-rest, anonymous app).
export const PUSH_COPY: Record<NotificationType, CopyEntry> = {
  like: {
    category: PUSH_CATEGORY.social,
    title: (a) => (a ? `@${a} liked your post` : "Someone liked your post"),
    url: (id) => (id ? `/post/${id}` : "/notifications"),
  },
  comment: {
    category: PUSH_CATEGORY.social,
    title: (a) =>
      a ? `@${a} commented on your post` : "New comment on your post",
    url: (id) => (id ? `/post/${id}` : "/notifications"),
  },
  reply: {
    category: PUSH_CATEGORY.social,
    title: () => "You got a reply to your message",
    // A reply notifies the original (sent-message) author; the reply renders on
    // the Sent tab. Matches notification-card.tsx's in-app deep-link.
    url: () => "/inbox?tab=sent",
    anonymous: true,
  },
  vote: {
    category: PUSH_CATEGORY.social,
    title: () => "New activity on your poll",
    url: (id) => (id ? `/post/${id}` : "/notifications"),
  },
  follow: {
    category: PUSH_CATEGORY.follow,
    title: (a) =>
      a ? `@${a} started following you` : "You have a new follower",
    url: (_id, a) => (a ? `/user/${a}` : "/notifications"),
  },
  message: {
    category: PUSH_CATEGORY.message,
    title: () => "You received an anonymous message",
    url: () => "/inbox",
    anonymous: true,
  },
  group_join: {
    category: PUSH_CATEGORY.group,
    title: (a) => (a ? `@${a} joined your group` : "New group member"),
    url: () => "/notifications",
  },
  group_invite: {
    category: PUSH_CATEGORY.group,
    title: (a) =>
      a ? `@${a} invited you to a group` : "You were invited to a group",
    url: () => "/notifications",
  },
  group_request: {
    category: PUSH_CATEGORY.group,
    title: (a) =>
      a ? `@${a} requested to join your group` : "New group join request",
    url: () => "/notifications",
  },
  group_accept: {
    category: PUSH_CATEGORY.group,
    title: () => "Your group request was accepted",
    url: () => "/notifications",
  },
  group_mention: {
    category: PUSH_CATEGORY.group,
    title: (a) =>
      a ? `@${a} mentioned you in a group` : "You were mentioned in a group",
    url: () => "/notifications",
  },
};

// Defensive fallback for any future/unmapped type (the Record above makes this
// unreachable while the map stays total — kept so a runtime surprise degrades
// gracefully instead of pushing an undefined title). Gated by master-on.
const GENERIC_COPY: CopyEntry = {
  category: PUSH_CATEGORY.social,
  title: () => "New activity on Umamin",
  url: () => "/notifications",
  anonymous: true,
};

type SendParams = {
  recipientId: string;
  type: NotificationType;
  targetId?: string;
  actorId?: string | null;
};

/**
 * Best-effort Web Push fan-out for one in-app notification. Mirrors notify()'s
 * contract: never throws into its caller, never sends to the actor, never puts
 * message/comment content in the payload. Invoked off the response's critical
 * path via after() in notify(). No-ops when VAPID keys are unset (local dev).
 */
export async function sendPushForNotification({
  recipientId,
  type,
  targetId = "",
  actorId = null,
}: SendParams): Promise<void> {
  if (!ensureVapid()) return;

  const copy = PUSH_COPY[type] ?? GENERIC_COPY;

  // Preference gate (master + per-category bit; 0 = off). One bounded PK read.
  const [recipient] = await db
    .select({ pushPrefs: userTable.pushPrefs })
    .from(userTable)
    .where(eq(userTable.id, recipientId))
    .limit(1);
  if (!recipient || (recipient.pushPrefs & copy.category) === 0) return;

  // Resolve the actor's username only for types that show one. message/reply
  // stay anonymous: never read or reveal a sender.
  let actor: string | null = null;
  if (!copy.anonymous && actorId) {
    const [row] = await db
      .select({ username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, actorId))
      .limit(1);
    actor = row?.username ?? null;
  }

  // Bounded fan-out: a user's devices (index seek; 1-3 rows typically).
  const subs = await db
    .select({
      endpoint: pushSubscriptionTable.endpoint,
      p256dh: pushSubscriptionTable.p256dh,
      auth: pushSubscriptionTable.auth,
    })
    .from(pushSubscriptionTable)
    .where(eq(pushSubscriptionTable.userId, recipientId));
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: copy.title(actor),
    url: copy.url(targetId, actor),
    // Client-side collapse key (unrestricted charset, unlike the push `topic`
    // header) so repeats of the same event replace rather than stack on-device.
    tag: `${type}:${targetId}`,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 3600, urgency: "normal" },
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = the subscription is dead/expired — prune it (scoped to this
        // recipient). Other failures are best-effort: log and move on.
        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(pushSubscriptionTable)
            .where(
              and(
                eq(pushSubscriptionTable.endpoint, sub.endpoint),
                eq(pushSubscriptionTable.userId, recipientId),
              ),
            );
        } else {
          console.error("web-push send failed", statusCode);
        }
      }
    }),
  );
}
