import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAppNavigate } from "@/lib/navigation";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

// apps/www redirected authed visitors off /login and /register server-side via
// getSession() (the __Host-session cookie is httpOnly, so it can't be read on
// the client). Here the guard runs client-side against /api/me: the query hits
// the API with the ambient cookie, and an authed session bounces to /inbox.
// This is a UX redirect only — the real auth guards live server-side.
export function useRedirectIfAuthed() {
  const navigate = useAppNavigate();
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });

  const isAuthed = !!data?.user;

  useEffect(() => {
    if (isAuthed) {
      navigate("/inbox", { replace: true });
    }
  }, [isAuthed, navigate]);
}
