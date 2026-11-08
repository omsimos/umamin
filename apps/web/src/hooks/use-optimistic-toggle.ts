import { useCallback, useEffect, useRef, useState } from "react";

export type ToggleState = { on: boolean; count: number };

// "unchanged" means the server was already in the requested state, so its
// counter never moved.
export type ToggleOutcome = "changed" | "unchanged";

type Options = {
  on: boolean;
  count: number;
  // Moves the server to `next`. Throws on failure.
  send: (next: boolean) => Promise<ToggleOutcome>;
  // Runs once per burst of taps with the state the server confirmed.
  onSettled: (state: ToggleState) => void;
  onError: (err: unknown) => void;
};

type Machine = {
  confirmed: ToggleState;
  desired: boolean;
  pending: boolean;
};

// A like-style toggle with one request in flight at a time. Taps made while a
// request is pending only change the desired state; when the request returns,
// one more request is sent if the latest tap disagrees with what the server
// confirmed. A failure rolls back to the last confirmed state, and the cache
// is written once, after the server's final answer, so the card never re-syncs
// to a half-finished burst.
export function useOptimisticToggle({
  on,
  count,
  send,
  onSettled,
  onError,
}: Options) {
  const [machine, setMachine] = useState<Machine>(() => ({
    confirmed: { on, count },
    desired: on,
    pending: false,
  }));
  const machineRef = useRef(machine);
  const callbacksRef = useRef({ send, onSettled, onError });

  useEffect(() => {
    callbacksRef.current = { send, onSettled, onError };
  });

  const commit = useCallback((next: Machine) => {
    machineRef.current = next;
    setMachine(next);
  }, []);

  // Mid-flight cache values are either stale refetches or older than the
  // writes still pending, so only adopt them while idle.
  useEffect(() => {
    const current = machineRef.current;
    if (current.pending) return;
    if (current.confirmed.on === on && current.confirmed.count === count) {
      return;
    }
    commit({ confirmed: { on, count }, desired: on, pending: false });
  }, [on, count, commit]);

  const run = useCallback(async () => {
    const start = machineRef.current.confirmed;
    commit({ ...machineRef.current, pending: true });

    while (machineRef.current.desired !== machineRef.current.confirmed.on) {
      const target = machineRef.current.desired;
      const base = machineRef.current.confirmed;
      let outcome: ToggleOutcome;
      try {
        outcome = await callbacksRef.current.send(target);
      } catch (err) {
        commit({ confirmed: base, desired: base.on, pending: false });
        if (base.on !== start.on || base.count !== start.count) {
          callbacksRef.current.onSettled(base);
        }
        callbacksRef.current.onError(err);
        return;
      }
      const nextCount =
        outcome === "changed"
          ? Math.max(base.count + (target ? 1 : -1), 0)
          : base.count;
      commit({
        ...machineRef.current,
        confirmed: { on: target, count: nextCount },
      });
    }

    const settled = machineRef.current.confirmed;
    commit({ confirmed: settled, desired: settled.on, pending: false });
    callbacksRef.current.onSettled(settled);
  }, [commit]);

  const toggle = useCallback(() => {
    const current = machineRef.current;
    const desired = !current.desired;
    commit({ ...current, desired });
    if (!current.pending) void run();
    return desired;
  }, [commit, run]);

  const { confirmed, desired, pending } = machine;
  const displayCount =
    desired === confirmed.on
      ? confirmed.count
      : Math.max(confirmed.count + (desired ? 1 : -1), 0);

  return { on: desired, count: displayCount, pending, toggle };
}
