/// <reference types="vite/client" />

// Client-exposed build-time env (Vite inlines `import.meta.env.VITE_*`). These
// mirror the apps/www `NEXT_PUBLIC_*` values the ported frontend reads.
interface ImportMetaEnv {
  // App version string shown in the account sheet + used to version the SW URL
  // (was NEXT_PUBLIC_VERSION; derived from the top CHANGELOG entry via `define`
  // in vite.config.ts — not an env var).
  readonly VITE_APP_VERSION?: string;
  // Comma-separated public verified-user list (was NEXT_PUBLIC_VERIFIED_USERS).
  readonly VITE_VERIFIED_USERS?: string;
  // Canonical site origin (was NEXT_PUBLIC_SITE_URL).
  readonly VITE_SITE_URL?: string;
  // Google Tag Manager container id, prod only (was GOOGLE_TAG_ID).
  readonly VITE_GTM_ID?: string;
  // R2 public bucket base URL for image src (was NEXT_PUBLIC_R2_PUBLIC_URL).
  readonly VITE_R2_PUBLIC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
