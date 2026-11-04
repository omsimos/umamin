import { useSyncExternalStore } from "react";
import { toStreakDay } from "@/lib/streak";

const subscribe = () => () => {};
const getServerSnapshot = () => null;

/**
 * Today's streak day on the client, null during SSR and hydration. Whether a
 * streak shows depends on the clock, and the server's clock and the device's
 * can land on different days (around Manila midnight, or a skewed phone
 * clock), so streak UI renders only after hydration to avoid a mismatch.
 */
export function useStreakToday(): number | null {
  return useSyncExternalStore(subscribe, toStreakDay, getServerSnapshot);
}
