import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import * as z from "zod";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL";

export class ApiError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 500,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function errorJson(c: Context, error: ApiError) {
  return c.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    error.status,
  );
}

export async function parseJson(c: Context) {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }
}

export function resultJson<T extends object>(
  c: Context,
  result: T,
  status = 200,
) {
  const maybeError = result as { error?: string };
  if (maybeError.error) {
    return errorJson(c, new ApiError(400, "BAD_REQUEST", maybeError.error));
  }

  return c.json(result, status as 200);
}

export function mapError(err: unknown) {
  if (err instanceof ApiError) return err;
  if (err instanceof z.ZodError) {
    return new ApiError(
      400,
      "VALIDATION_ERROR",
      "Invalid request",
      z.flattenError(err),
    );
  }
  if (err instanceof HTTPException) {
    return new ApiError(
      err.status as ApiError["status"],
      err.status === 401 ? "UNAUTHORIZED" : "BAD_REQUEST",
      err.message || "Request failed",
    );
  }
  if (err instanceof Error && err.message === "Unauthorized") {
    return new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }
  return new ApiError(500, "INTERNAL", "Internal server error");
}

export function publicCache(c: Context, maxAgeSeconds: number) {
  c.header(
    "Cache-Control",
    `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds}`,
  );
}

export function privateNoStore(c: Context) {
  c.header("Cache-Control", "private, no-store, max-age=0");
  c.header("Vary", "Cookie");
}
