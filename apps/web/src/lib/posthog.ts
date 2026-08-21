import type { PostHog, PostHogConfig } from "posthog-js";

// Browser-side error tracking (PostHog project "Umamin").
//
// Deliberately NOT @posthog/react's <PostHogProvider>: that imports posthog-js
// at module scope, and the provider tree renders during SSR — so the ~260KB
// (~84KB gzip) SDK would land in the Worker's startup bundle, which is already
// 1.3MB and is parsed on every cold start. The dynamic import below keeps
// posthog-js in a client-only chunk the Worker never loads.
//
// Everything is gated on `import.meta.env.PROD`, so `pnpm dev:web` never ships
// events. MODE separates the two deployed builds (`--mode staging` →
// dev.umamin.link, default → www.umamin.link) inside the one PostHog project.

const TOKEN = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

export const ERROR_TRACKING_ENABLED = Boolean(import.meta.env.PROD && TOKEN);

// Error tracking ONLY. Product analytics stays with GTM/GA, so every capture
// surface the SDK would otherwise turn on is switched off here — `defaults`
// alone would enable pageviews. Session replay is off both locally and, via
// `disable_session_recording`, against whatever the project's remote config
// says, because this app carries anonymous messages.
const OPTIONS: Partial<PostHogConfig> = {
  api_host: HOST,
  // Newest date the installed @posthog/types allows; bumping posthog-js can
  // widen the union, and moving to a later date opts into further changed
  // defaults — re-read the overrides below before doing so.
  defaults: "2026-06-25",
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    // console.error is noisy and often not an error at all.
    capture_console_errors: false,
  },
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_heatmaps: false,
  capture_dead_clicks: false,
  capture_performance: false,
  disable_session_recording: true,
  disable_surveys: true,
  // No identify() call is made, so this keeps anonymous visitors from each
  // minting a person profile (PostHog bills per profile).
  person_profiles: "identified_only",
};

let pending: Promise<PostHog | null> | null = null;

function load(): Promise<PostHog | null> {
  pending ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(TOKEN as string, OPTIONS);
      posthog.register({ environment: import.meta.env.MODE });
      return posthog;
    })
    // A blocked or failed SDK load must never surface to the user, and must not
    // be retried per call — the rejected promise is cached on purpose.
    .catch(() => null);
  return pending;
}

/**
 * Registers the unhandled-error/rejection handlers. Called once on mount, so
 * exceptions thrown before hydration completes are not covered.
 */
export function initErrorTracking(): void {
  if (!ERROR_TRACKING_ENABLED || typeof window === "undefined") return;
  void load();
}

/**
 * Reports an error the SDK's autocapture cannot see. React error boundaries
 * (the router's `errorComponent`) swallow render errors before they reach
 * `window.onerror`, so those routes have to report explicitly.
 */
export function captureException(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  if (!ERROR_TRACKING_ENABLED || typeof window === "undefined") return;
  void load().then((posthog) => posthog?.captureException(error, properties));
}
