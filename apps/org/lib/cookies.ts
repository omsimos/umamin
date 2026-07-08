const isProduction = process.env.NODE_ENV === "production";

// __Host- prefix in prod hardens the cookie (host-only, secure, path=/).
export const SESSION_COOKIE_NAME = isProduction ? "__Host-session" : "session";
