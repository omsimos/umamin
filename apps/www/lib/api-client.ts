export type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "REQUEST_FAILED",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function getBrowserApiOrigin() {
  const configured = process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/$/, "");
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8787";
  }

  return "";
}

function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = getBrowserApiOrigin();
  if (!origin) {
    throw new ApiClientError(
      "NEXT_PUBLIC_API_ORIGIN is not configured",
      0,
      "CONFIGURATION_ERROR",
    );
  }
  return `${origin}${path}`;
}

export function getApiOrigin() {
  return getBrowserApiOrigin();
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as
    | (ApiErrorEnvelope & T)
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      body?.error?.message ?? "Request failed",
      response.status,
      body?.error?.code,
      body?.error?.details,
    );
  }

  return body as T;
}

export async function apiClientFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (init.body && !isFormData && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });
}

export async function getJson<T>(path: string, init: RequestInit = {}) {
  return parseJsonResponse<T>(
    await apiClientFetch(path, {
      ...init,
      method: init.method ?? "GET",
    }),
  );
}

export async function postJson<T>(path: string, value?: unknown) {
  return parseJsonResponse<T>(
    await apiClientFetch(path, {
      method: "POST",
      body: value === undefined ? undefined : JSON.stringify(value),
    }),
  );
}

export async function patchJson<T>(path: string, value?: unknown) {
  return parseJsonResponse<T>(
    await apiClientFetch(path, {
      method: "PATCH",
      body: value === undefined ? undefined : JSON.stringify(value),
    }),
  );
}

export async function deleteJson<T>(path: string) {
  return parseJsonResponse<T>(
    await apiClientFetch(path, {
      method: "DELETE",
    }),
  );
}

export function apiClientErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return "Please sign in again to continue.";
    }

    if (error.status === 403) {
      return "You do not have permission to do that.";
    }

    if (error.status === 404) {
      return "That item could not be found.";
    }

    return error.message || fallback;
  }

  if (error instanceof TypeError) {
    return "Could not reach the API. Check your connection and try again.";
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
