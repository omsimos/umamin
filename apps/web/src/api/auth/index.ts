// Page-level auth routes (NOT under /api): the orchestrator mounts googleAuthApp
// at /auth/google so the OAuth initiator is /auth/google and the callback is
// /auth/google/callback — byte-identical paths to apps/www (the Google console
// redirect URI is unchanged across the cutover).
export { type GoogleAuthType, googleAuthApp } from "./google";
