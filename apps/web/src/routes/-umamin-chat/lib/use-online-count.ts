import { useQuery } from "@tanstack/react-query";
import { CHAT_STATS_MAX_AGE, SECOND } from "@/lib/chat/constants";
import { visibleOnline } from "@/lib/chat/stats";
import { fetchChatStats } from "@/lib/query-fetchers";

/** The lobby page's headcount. Polls slower than the edge TTL, and only while
 *  the tab is visible, so an idle tab costs nothing. */
export function useOnlineCount(): number | null {
  const { data } = useQuery({
    queryKey: ["chat-stats"],
    queryFn: fetchChatStats,
    staleTime: CHAT_STATS_MAX_AGE * SECOND,
    refetchInterval: 2 * CHAT_STATS_MAX_AGE * SECOND,
    retry: false,
  });
  return visibleOnline(data);
}
