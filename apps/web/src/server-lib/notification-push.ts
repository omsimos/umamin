import { WebPushError } from "@mmmike/web-push/send";
import type { NotificationType } from "@umamin/db/schema/notification";
import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { and, eq } from "drizzle-orm";
import { PUSH_CATEGORY } from "../lib/push-prefs";
import type { Db } from "./db";
import type { AppEnv } from "./env";
import { captureServerException } from "./posthog";
import { sendPush } from "./push";

// Web Push fan-out for one in-app notification (ported from apps/www/lib/server/
// push.ts). The Node `web-push` dependency and its module-init VAPID setup are
// replaced by server-lib/push.ts (@mmmike/web-push, pure WebCrypto) with the
// VAPID keypair read PER CALL from `env` instead of process.env at module init.

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
    // A reply notifies the original (sent-message) author; deep-link to the
    // thread page. Matches notification-card.tsx's in-app deep-link.
    url: (id) => (id ? `/inbox/${id}` : "/inbox?tab=sent"),
    anonymous: true,
  },
  thread: {
    category: PUSH_CATEGORY.message,
    title: () => "New reply in an anonymous conversation",
    url: (id) => (id ? `/inbox/${id}` : "/inbox"),
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

function vapidFromEnv(env: AppEnv) {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: env.VAPID_SUBJECT ?? "mailto:support@umamin.link",
  };
}

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
 * path via `defer` (ctx.waitUntil) in notify(). No-ops when VAPID keys are unset.
 */
export async function sendPushForNotification(
  db: Db,
  env: AppEnv,
  { recipientId, type, targetId = "", actorId = null }: SendParams,
): Promise<void> {
  const vapid = vapidFromEnv(env);
  if (!vapid) return;

  const copy = PUSH_COPY[type] ?? GENERIC_COPY;

  // All three reads key off values already in hand, so they run together rather
  // than as three chained Tokyo round trips per engagement event. The gates
  // below become post-filters: an opted-out recipient now pays two extra
  // parallel reads (no extra wall-clock) so every opted-in one saves two hops.
  const [recipientRows, actorRows, subs] = await Promise.all([
    // Preference gate (master + per-category bit; 0 = off). One bounded PK read.
    db
      .select({ pushPrefs: userTable.pushPrefs })
      .from(userTable)
      .where(eq(userTable.id, recipientId))
      .limit(1),
    // Resolve the actor's username only for types that show one. message/reply
    // stay anonymous: never read or reveal a sender.
    !copy.anonymous && actorId
      ? db
          .select({ username: userTable.username })
          .from(userTable)
          .where(eq(userTable.id, actorId))
          .limit(1)
      : Promise.resolve([]),
    // Bounded fan-out: a user's devices (index seek; 1-3 rows typically).
    db
      .select({
        endpoint: pushSubscriptionTable.endpoint,
        p256dh: pushSubscriptionTable.p256dh,
        auth: pushSubscriptionTable.auth,
      })
      .from(pushSubscriptionTable)
      .where(eq(pushSubscriptionTable.userId, recipientId)),
  ]);

  const recipient = recipientRows[0];
  if (!recipient || (recipient.pushPrefs & copy.category) === 0) return;
  if (subs.length === 0) return;

  const actor = actorRows[0]?.username ?? null;

  const payload = {
    title: copy.title(actor),
    url: copy.url(targetId, actor),
    // On-device collapse key ONLY — sw.js pairs it with renotify:true so a
    // repeat replaces what is displayed but still alerts. Deliberately not sent
    // as the RFC 8030 `topic` header: that collapses UNDELIVERED pushes at the
    // push service, and this key is not unique per push (follow/message carry an
    // empty targetId; like/comment titles name an actor), so a topic built from
    // it would silently drop notifications.
    tag: `${type}:${targetId}`,
  };

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const result = await sendPush(sub, payload, vapid, { ttl: 3600 });
        // 404/410 = the subscription is dead/expired — prune it (scoped to this
        // recipient).
        if (!result.ok && result.expired) {
          await db
            .delete(pushSubscriptionTable)
            .where(
              and(
                eq(pushSubscriptionTable.endpoint, sub.endpoint),
                eq(pushSubscriptionTable.userId, recipientId),
              ),
            );
        }
      } catch (err) {
        // Other failures (disallowed endpoint / push-service error) are
        // best-effort: log and move on.
        // toJSON() is the lib's log-safe shape:
        // statusCode/retryAfterMs separate rate-limiting (429) from
        // misconfiguration (401/403 = VAPID rejected), with the endpoint — a
        // capability URL — truncated rather than logged whole.
        // Only misconfiguration and unknown throws are reported: 429/5xx is
        // push-service weather, not something to triage.
        if (err instanceof WebPushError) {
          console.error("web-push send rejected", err.toJSON());
          if (err.statusCode === 401 || err.statusCode === 403) {
            captureServerException(env, undefined, err, {
              properties: { push: "vapid rejected", type },
            });
          }
        } else {
          console.error("web-push send failed", err);
          captureServerException(env, undefined, err, {
            properties: { push: "send failed", type },
          });
        }
      }
    }),
  );
}
