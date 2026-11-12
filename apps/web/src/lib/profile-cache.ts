// How long the Worker caches GET /api/public/user/:username
// (api/routes/public.ts). The profile route loader reads it too: a profile
// cache entry written on this device inside this window can be newer than the
// server's cached response.
export const PUBLIC_PROFILE_MAX_AGE_SECONDS = 300;
