import "server-only";

import type { SessionValidationResult } from "@umamin/core/session";
import { apiJson } from "./api";

export async function getSession(): Promise<SessionValidationResult> {
  return apiJson<SessionValidationResult>("/api/auth/session");
}
