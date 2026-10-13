import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query";
import { fetchBlockedUsersPage } from "@/lib/query-fetchers";
import { AccountListSection } from "./account-list-section";
import { unblockUserAction } from "./actions";

export function BlockedUsersSection() {
  const queryClient = useQueryClient();

  return (
    <AccountListSection
      label="Blocked Users"
      queryKey={queryKeys.blockedUsers()}
      fetchPage={fetchBlockedUsersPage}
      toListed={(user) => ({ ...user, listedAt: user.blockedAt })}
      remove={unblockUserAction}
      removeLabel="Unblock"
      pastTense="blocked"
      emptyText="You haven't blocked anyone."
      onRemoved={({ username }) => {
        queryClient.removeQueries({
          queryKey: queryKeys.userProfileViewer(username),
        });
        toast.success("User unblocked.");
      }}
    />
  );
}
