import { type RefObject, useEffect } from "react";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Minimal modal semantics for the hand-rolled fullscreen overlays
 *  (celebration, handle reveal): Escape dismisses, and Tab wraps within the
 *  overlay so focus can't wander into the blurred chat behind it. The Radix
 *  sheets/dialogs bring their own trap — this is only for bare divs with
 *  role="alertdialog". */
export function useModalTrap(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onDismiss();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      // Wrap at both ends; recapture focus that already escaped the overlay.
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !node.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ref, onDismiss]);
}
