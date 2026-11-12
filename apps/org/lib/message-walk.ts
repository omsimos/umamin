import type { MessagesResponse, OrgMessageItem } from "@/lib/query-types";

export class RateLimitedError extends Error {}

// The read limit outlasted every retry for one page. Carries the pages that
// did load, so the caller can still export those instead of nothing.
export class WalkStoppedError extends Error {
  constructor(readonly loaded: OrgMessageItem[]) {
    super("Stopped by the read limit");
  }
}

type WalkOptions = {
  onProgress?: (loaded: number) => void;
  onPause?: (loaded: number) => void;
  wait?: (ms: number) => Promise<void>;
  retryMs?: number;
  maxRetries?: number;
};

// Loads every inbox page in order. The read route is rate limited per IP, so a
// large inbox gets a 429 partway through. That is a pause, not a failure: wait
// and ask for the same page again. The retry count is per page because the
// limiter refills: a large inbox pauses many times and each pause clears.
export async function loadAllMessages(
  fetchPage: (cursor: string | null) => Promise<MessagesResponse>,
  {
    onProgress,
    onPause,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    retryMs = 20_000,
    maxRetries = 6,
  }: WalkOptions = {},
): Promise<OrgMessageItem[]> {
  const all: OrgMessageItem[] = [];
  let cursor: string | null = null;

  do {
    let page: MessagesResponse | null = null;
    for (let attempt = 0; page === null; attempt++) {
      try {
        page = await fetchPage(cursor);
      } catch (err) {
        if (!(err instanceof RateLimitedError)) throw err;
        if (attempt >= maxRetries) throw new WalkStoppedError(all);
        onPause?.(all.length);
        await wait(retryMs);
      }
    }
    all.push(...page.messages);
    onProgress?.(all.length);
    cursor = page.nextCursor;
  } while (cursor);

  return all;
}
