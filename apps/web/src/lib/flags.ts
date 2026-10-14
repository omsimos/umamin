// Client-safe feature-flag surface. Values are resolved in the Worker
// (server-lib/flags.ts) and read here through /api/flags — posthog-js never
// evaluates a flag, so nothing depends on the lazily-loaded SDK.

/**
 * Umamin Pro is built but not launched: the flag gates the OFFER (the /tiers Pro
 * tab, the settings upsell, and the checkout action), not the entitlements. A
 * user whose `proUntil` is still valid keeps the badge, theme and ad-free perks
 * regardless — flipping this off must never revoke something someone paid for.
 */
export const FLAG_UMAMIN_PRO = "umamin-pro";

/**
 * Turns classifier labels on: covers severe posts, comments and notes, collapses
 * drama for viewers who hide it, and down-ranks both in Hot. It is a GLOBAL
 * switch, resolved with no viewer, because the label is baked into shared
 * cached pages and the Hot list. Off means shadow mode: content is still
 * classified and stored, nothing changes for users. The opt-in private message
 * filter does not depend on it (the receiver chose it).
 */
export const FLAG_CONTENT_MODERATION = "content-moderation";

/**
 * Umamin Chat on this app (/chat, the Durable Object rooms). A GLOBAL switch
 * resolved with no viewer, like content moderation: chat is anonymous, so
 * there is no stable viewer to bucket. It gates the routes and the socket
 * upgrades, so the surface stays unreachable in production until launch.
 */
export const FLAG_UMAMIN_CHAT = "umamin-chat";
