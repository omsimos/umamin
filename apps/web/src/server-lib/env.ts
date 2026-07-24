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
};

export type AppEnv = Env & Partial<Secrets>;
