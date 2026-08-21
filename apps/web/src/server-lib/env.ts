// Secrets are provisioned via `wrangler secret put` (Phase 2 deploy) and appear
// on the request `env` at runtime, but the generated worker-configuration.d.ts
// only types `vars`/bindings — so this augments the binding type with the
// secrets server-lib reads. Marked Partial: local/test runs may not set them,
// and every consumer already fails open / no-ops when a secret is absent.
export type Secrets = {
  TURSO_CONNECTION_URL: string;
  TURSO_AUTH_TOKEN: string;
  AES_256_GCM_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  R2_PUBLIC_URL: string;
  // Comma-separated moderator usernames (server-only; see moderation.ts).
  MODERATOR_USERS: string;
  // Umamin Pro checkout + order webhook (see server-lib/lemonsqueezy.ts).
  // Per-environment: staging points at a test-mode store, production at the
  // live one, so a replayed test order can never grant production Pro.
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_STORE_ID: string;
  LEMONSQUEEZY_VARIANT_ID: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  // Turnstile siteverify secret (see server-lib/turnstile.ts). Absent =>
  // captcha verification is skipped, which is how local dev and the test
  // suites sign in; the public site key is VITE_TURNSTILE_SITE_KEY.
  TURNSTILE_SECRET: string;
};

export type AppEnv = Env & Partial<Secrets>;
