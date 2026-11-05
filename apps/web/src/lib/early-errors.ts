type EarlyError = ErrorEvent | PromiseRejectionEvent;

/**
 * Holds the page's uncaught errors and rejections until the error tracker
 * loads, so deferring the SDK doesn't drop what happens before it. Capped,
 * because a render loop can throw on every frame.
 */
export function bufferEarlyErrors(cap: number) {
  const events: EarlyError[] = [];
  const hold = (event: Event) => {
    if (events.length < cap) events.push(event as EarlyError);
  };

  window.addEventListener("error", hold);
  window.addEventListener("unhandledrejection", hold);

  return {
    /** Stops listening and hands each held event over, oldest first. */
    flush(capture: (event: EarlyError) => void) {
      window.removeEventListener("error", hold);
      window.removeEventListener("unhandledrejection", hold);
      for (const event of events.splice(0)) capture(event);
    },
  };
}

/**
 * Runs `task` once the main thread is idle, or after `timeout` ms at the
 * latest. Safari has no requestIdleCallback.
 */
export function whenIdle(task: () => void, timeout: number): void {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(task, { timeout });
    return;
  }
  setTimeout(task, timeout);
}
