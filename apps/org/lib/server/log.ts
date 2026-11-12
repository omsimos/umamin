import "server-only";

import { DrizzleQueryError } from "drizzle-orm";

// A failed query's default message appends its bound parameters, which here can
// be a password hash or an encrypted message. Log the SQL and the driver's
// reason only.
export function logServerError(label: string, err: unknown): void {
  if (err instanceof DrizzleQueryError) {
    console.error(label, { query: err.query, cause: err.cause?.message });
    return;
  }
  console.error(label, err);
}
