import { useQuery } from "@tanstack/react-query";
import AdContainer from "@/components/ad-container";
import { ADS_ENABLED, type AdPlacement } from "@/lib/ad-placements";
import { hasUmaminPro } from "@/lib/pro";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

type Props = {
  placement: AdPlacement;
  className?: string;
};

// The ad slot. The name predates SSR: the box is now server-rendered so its
// height is reserved before hydration, and only the AdSense <ins> waits for
// the browser (see AdContainer).
//
// The Pro check must give the same answer on the server and the first client
// render. Both read the same query cache: routes that call loadViewer prime
// /api/me during SSR and the cache is hydrated as-is, and an anonymous viewer
// has no entry on either side. With no answer yet the slot renders, so only a
// Pro viewer on a page that doesn't prime the viewer sees the box collapse
// once /api/me returns.
export function ClientOnlyAdContainer({ placement, className }: Props) {
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });

  // ADS_ENABLED is a build-time literal, so with ads off this is the whole
  // component: no wrapper, no reserved min-height, nothing to hide.
  if (!ADS_ENABLED) return null;

  // Ad-free is a Pro perk. Only a POSITIVELY Pro viewer (payload loaded, Pro
  // horizon in the future) removes the slot — while /api/me is pending, errored,
  // or anonymous, ads stay on, so a slow read can't silently drop revenue.
  if (hasUmaminPro(data?.user?.proUntil)) return null;

  return <AdContainer className={className} placement={placement} />;
}
