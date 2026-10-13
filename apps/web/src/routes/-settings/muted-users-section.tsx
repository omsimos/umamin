import { toast } from "sonner";
import { unmuteUserAction } from "@/lib/actions";
import { queryKeys } from "@/lib/query";
import { fetchMutedUsersPage } from "@/lib/query-fetchers";
import { AccountListSection } from "./account-list-section";

export function MutedUsersSection() {
  return (
    <AccountListSection
      label="Muted Users"
      queryKey={queryKeys.mutedUsers()}
      fetchPage={fetchMutedUsersPage}
      toListed={(user) => ({ ...user, listedAt: user.mutedAt })}
      remove={unmuteUserAction}
      removeLabel="Unmute"
      pastTense="muted"
      emptyText="You haven't muted anyone."
      onRemoved={() => toast.success("User unmuted.")}
    />
  );
}
