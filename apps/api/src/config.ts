export const PUBLIC_CACHE_SECONDS = 120;
export const USER_CACHE_SECONDS = 604800;

export function getAllowedOrigins() {
  const developmentOrigins =
    process.env.NODE_ENV === "production"
      ? []
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        ];

  return [
    process.env.WEB_ORIGIN,
    ...(process.env.CORS_ORIGINS ?? "").split(","),
    ...developmentOrigins,
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => !!origin);
}

export function cookieDomain() {
  return process.env.NODE_ENV === "production"
    ? process.env.SESSION_COOKIE_DOMAIN
    : undefined;
}

export function webOrigin() {
  return process.env.WEB_ORIGIN ?? "http://localhost:3000";
}

export function validateRuntimeConfig() {
  if (process.env.NODE_ENV !== "production") return;

  const missing = [
    "WEB_ORIGIN",
    "SESSION_COOKIE_DOMAIN",
    "TURSO_CONNECTION_URL",
    "AES_256_GCM_KEY",
  ].filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required production API environment variables: ${missing.join(", ")}`,
    );
  }
}
