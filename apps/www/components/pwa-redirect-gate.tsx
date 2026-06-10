import { PwaRedirect } from "@/components/pwa-redirect";
import { getSession } from "@/lib/auth";

// Server-authoritative target for the standalone redirect: the session cookie
// is httpOnly (unreadable by the client), so we resolve auth here and hand the
// client component a concrete destination. Logged-in standalone users land in
// their inbox; logged-out users get login (with its register link) instead of
// being bounced /inbox -> /login. Must render inside <Suspense> on the static
// marketing page — getSession() reads cookies and is dynamic under cacheComponents.
export async function PwaRedirectGate() {
  const { session } = await getSession();
  return <PwaRedirect target={session ? "/inbox" : "/login"} />;
}
