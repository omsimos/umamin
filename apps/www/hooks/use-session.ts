"use client";

import { useQuery } from "@tanstack/react-query";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchSession } from "@/lib/query-fetchers";

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: fetchSession,
    ...privateQueryDefaults,
    staleTime: 60_000,
  });
}
