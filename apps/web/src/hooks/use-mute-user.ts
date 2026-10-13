import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { muteUserAction, unmuteUserAction } from "@/lib/actions";
import { ExpectedError } from "@/lib/expected-error";
import { queryKeys } from "@/lib/query";

type MuteInput = { userId: string; username?: string; mute: boolean };

// One mutation for every Mute/Unmute entry point (post, comment and note
// menus, profile). Refetching the feed and notes lets the per-viewer overlay
// drop or restore the account's content.
export function useMuteUser() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ userId, mute }: MuteInput) => {
      const res = mute
        ? await muteUserAction({ userId })
        : await unmuteUserAction({ userId });
      if (res && "error" in res && res.error) {
        throw new ExpectedError(res.error);
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.postsRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notesRoot() });
      queryClient.invalidateQueries({ queryKey: ["post-comments"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.mutedUsers() });
      if (input.username) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.userProfileViewer(input.username),
        });
      }

      const handle = input.username ? `@${input.username}` : "this user";
      if (input.mute) {
        toast.success(`Muted ${handle}. They won't be notified.`, {
          action: {
            label: "Undo",
            onClick: () => mutation.mutate({ ...input, mute: false }),
          },
        });
      } else {
        toast.success(`Unmuted ${handle}.`);
      }
    },
    onError: (err, input) => {
      console.error(err);
      toast.error(
        err instanceof ExpectedError
          ? err.message
          : `Couldn't ${input.mute ? "mute" : "unmute"} user.`,
      );
    },
  });

  return mutation;
}
