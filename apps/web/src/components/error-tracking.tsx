import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { initErrorTracking, registerViewer } from "@/lib/posthog";
import { queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

export function ErrorTracking() {
  useEffect(() => {
    initErrorTracking();
  }, []);

  // `enabled: false` so this only READS the already-resolved viewer — mounted on
  // every page, a fetching subscription would add an /api/me round trip to every
  // anonymous public load. The queryFn is declared purely for the result type.
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    enabled: false,
  });

  const viewerId = data?.user?.id;

  useEffect(() => {
    registerViewer(viewerId ?? null);
  }, [viewerId]);

  return null;
}
