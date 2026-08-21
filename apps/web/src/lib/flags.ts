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
