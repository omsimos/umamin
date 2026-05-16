import { ApiClientError } from "./api-client";

export function queryErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return "Please sign in again to continue.";
    }

    if (error.status === 403) {
      return "You do not have permission to view this.";
    }

    if (error.status === 404) {
      return "This content could not be found.";
    }

    return error.message || fallback;
  }

  if (error instanceof TypeError) {
    return "Could not reach the API. Check your connection and try again.";
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
