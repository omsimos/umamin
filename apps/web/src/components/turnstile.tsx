import { useEffect, useImperativeHandle, useRef, useState } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

/**
 * Configured-means-on, mirroring `isTurnstileEnabled` on the server: with no
 * site key nothing renders and no token is sent, which is how local dev and the
 * jsdom suites submit these forms. Exported so a form knows whether to gate its
 * submit button — never gate on a captcha that isn't there.
 */
export const TURNSTILE_ENABLED = !!SITE_KEY;

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: Record<string, unknown>,
  ) => string | undefined;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = { reset: () => void };

// One load for the page, shared by both auth forms. `render=explicit` keeps
// Turnstile from auto-binding to the DOM so the widget id stays ours — which is
// what makes reset() possible, and tokens are single-use.
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * The Turnstile widget for one form. `action` is echoed back by siteverify and
 * re-checked server-side, so a token minted here can't be spent on the other
 * form — pass the same string the handler verifies.
 *
 * `interaction-only` keeps it invisible for the majority who pass the
 * non-interactive check, and shows a challenge only when one is actually
 * needed.
 */
export function Turnstile({
  ref,
  action,
  onToken,
}: {
  ref?: React.Ref<TurnstileHandle>;
  action: "login" | "signup";
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [failed, setFailed] = useState(false);

  // Kept in a ref so re-rendering the parent (every keystroke in the form)
  // never re-runs the mount effect and re-renders the widget.
  onTokenRef.current = onToken;

  useImperativeHandle(ref, () => ({
    reset: () => {
      const id = widgetIdRef.current;
      if (id && window.turnstile) {
        window.turnstile.reset(id);
        onTokenRef.current("");
      }
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetIdRef.current =
          window.turnstile.render(el, {
            sitekey: SITE_KEY,
            action,
            appearance: "interaction-only",
            size: "flexible",
            theme: "auto",
            callback: (token: string) => {
              setFailed(false);
              onTokenRef.current(token);
            },
            // A token lives 300s. Expiring one mid-form would fail server-side
            // as already-spent-or-stale, so clear it and let Turnstile reissue.
            "expired-callback": () => onTokenRef.current(""),
            "error-callback": () => {
              onTokenRef.current("");
              setFailed(true);
            },
          }) ?? null;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      if (id && window.turnstile) {
        window.turnstile.remove(id);
        widgetIdRef.current = null;
      }
    };
  }, [action]);

  if (!SITE_KEY) return null;

  return (
    <div>
      <div ref={containerRef} />
      {failed && (
        <p role="alert" className="text-red-500 text-sm font-medium">
          Couldn't load the human check. Reload the page and try again.
        </p>
      )}
    </div>
  );
}
