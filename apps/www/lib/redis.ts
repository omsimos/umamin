import "server-only";

import { Redis } from "@upstash/redis";

// Shared Upstash client. Built only when the Vercel KV/Upstash integration env is
// present (KV_REST_API_URL/TOKEN); otherwise `null` so every caller degrades to a
// no-op / direct-DB path and local dev needs no Redis. Reused by rate limiting,
// the session cache, and the feed "new posts" head-key.
const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;
