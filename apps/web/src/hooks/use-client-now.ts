import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
const TICK_MS = 15_000;

const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
};
// Floored to the minute so consecutive reads agree, which useSyncExternalStore
// requires; the ticker only re-renders when the minute turns.
const getSnapshot = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const getServerSnapshot = () => null;

/**
 * The current time to the minute on the client, null during SSR and
 * hydration. The server's clock and the device's disagree, so UI that depends
 * on "now" has to render a clock-free state until hydration is done, or React
 * throws a hydration mismatch.
 */
export function useClientNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
