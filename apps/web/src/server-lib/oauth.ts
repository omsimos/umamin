import { Google } from "arctic";
import type { AppEnv } from "./env";

// arctic is fetch-based (Workers-safe). The singleton `google` client that
// apps/www built at module init from process.env is replaced by a per-request
// factory bound to the request env (the Workers "explicit deps" rule).
export function buildGoogle(env: AppEnv): Google {
  return new Google(
    env.GOOGLE_CLIENT_ID ?? "",
    env.GOOGLE_CLIENT_SECRET ?? "",
    env.GOOGLE_REDIRECT_URI ?? "",
  );
}
