import "server-only";

import { Redis } from "@upstash/redis";

// Shared Upstash client. Built only when KV_REST_API_URL/TOKEN are present;
// otherwise `null` so every caller degrades to a no-op (local dev needs no Redis).
const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;
