import {
  type SessionCookieOptions,
  type SessionValidationResult,
  validateSessionFromCookies,
} from "@umamin/core/session";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

export function cookieWriter(c: Context) {
  return {
    set(name: string, value: string, options: SessionCookieOptions) {
      setCookie(c, name, value, {
        httpOnly: options.httpOnly,
        sameSite: options.sameSite,
        secure: options.secure,
        expires: options.expires,
        maxAge: options.maxAge,
        path: options.path,
        domain: options.domain,
      });
    },
  };
}

export function cookieReader(c: Context) {
  return {
    get(name: string) {
      return getCookie(c, name);
    },
  };
}

export async function getSession(c: Context): Promise<SessionValidationResult> {
  return validateSessionFromCookies(cookieReader(c));
}
