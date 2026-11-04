// Carries the HTTP status into the message so error tracking can tell a 429
// (rate limit) from a 5xx (server or database failure) on the same path.
export class RequestFailedError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Request failed for ${path} (${status})`);
    this.name = "RequestFailedError";
    this.status = status;
  }
}
