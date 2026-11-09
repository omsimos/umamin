import type { GoogleOAuthConfig } from "@umamin/auth/google";
import type { AppEnv } from "./env";

// apps/www built a singleton Google client at module init from process.env. On
// Workers the config is read per request from the request env instead (the
// Workers "explicit deps" rule).
export function googleOAuthConfig(env: AppEnv): GoogleOAuthConfig {
  return {
    clientId: env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: env.GOOGLE_REDIRECT_URI ?? "",
  };
}
