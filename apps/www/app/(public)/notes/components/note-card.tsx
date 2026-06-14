import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { cn } from "@umamin/ui/lib/utils";
import {
  BadgeCheckIcon,
  DownloadIcon,
  FlameIcon,
  MessageSquareTextIcon,
  MessageSquareXIcon,
  ScanFaceIcon,
  ShieldXIcon,
  UserXIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addNoteReactionAction,
  removeNoteAction,
  removeNoteReactionAction,
} from "@/app/actions/note";
import { BlockUserDialog } from "@/components/block-user-dialog";
import { GroupBadge } from "@/components/group-badge";
import { Menu } from "@/components/menu";
import { PostBody } from "@/components/post-body";
import {
  BURST_ACTION_REJECT_MESSAGE,
  useBurstAction,
} from "@/hooks/use-burst-action";
import { vibrate } from "@/lib/haptics";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { patchNote } from "@/lib/query-cache";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import type { NoteItem, NotesResponse } from "@/lib/query-types";
import {
  getActionError,
  hasUmaminPlus,
  isAlreadyReacted,
  isAlreadyRemoved,
  saveImage,
  shortTimeAgo,
} from "@/lib/utils";
import { ReplyDrawer } from "./reply-drawer";

type Props = {
  data: NoteItem;
  isAuthenticated: boolean;
  currentUserId?: string;
  index?: number;
  isHighlighted?: boolean;
};

export function NoteCard({
  data,
  isAuthenticated,
  currentUserId,
  index = 0,
  isHighlighted = false,
}: Props) {
  const user = data.user;
  const username = user?.username;
  const [replyOpen, setReplyOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const queryClient = useQueryClient();

  // Anonymous notes have no identified author to block.
  const canBlock =
    isAuthenticated &&
    !data.isAnonymous &&
    !!user?.id &&
    !!currentUserId &&
    currentUserId !== user.id;

  // Shared, deduped current-user cache — read only for the maintainer flag.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    enabled: isAuthenticated,
  });
  // A maintainer can remove any note that isn't clearly their own. Anonymous
  // notes ship no author to the client, so they're always removable by a mod
  // (a mod clearing their own anonymous note is harmless).
  const isOwnNote = !!user?.id && !!currentUserId && user.id === currentUserId;
  const canModerate =
    isAuthenticated && currentUser?.user?.isModerator === true && !isOwnNote;

  const [reacted, setReacted] = useState(data.isReacted === true);
  const [reactions, setReactions] = useState(data.reactionCount ?? 0);

  // Scalar deps only — see post-card.tsx: depending on `data` itself would
  // clobber optimistic state on every parent render.
  useEffect(() => {
    setReacted(data.isReacted === true);
    setReactions(data.reactionCount ?? 0);
  }, [data.isReacted, data.reactionCount]);

  const handleReactAction = useBurstAction(
    async (prevReacted: boolean) =>
      prevReacted
        ? removeNoteReactionAction({ noteId: data.id })
        : addNoteReactionAction({ noteId: data.id }),
    { limit: 4, rejectMessage: BURST_ACTION_REJECT_MESSAGE },
  );

  const syncReactionCache = (nextReacted: boolean, nextCount: number) => {
    queryClient.setQueriesData<InfiniteData<NotesResponse>>(
      { queryKey: queryKeys.notesRoot() },
      (current) =>
        patchNote(current, data.id, (note) => ({
          ...note,
          isReacted: nextReacted,
          reactionCount: nextCount,
        })),
    );
  };

  const handleReact = async () => {
    const prevReacted = reacted;
    const prevCount = reactions;
    const nextReacted = !prevReacted;
    const nextCount = prevReacted ? Math.max(prevCount - 1, 0) : prevCount + 1;

    // Micro-tick on reacting only, matching the like button.
    if (nextReacted) {
      vibrate(5);
    }

    setReacted(nextReacted);
    setReactions(nextCount);

    try {
      const res = await handleReactAction(prevReacted);
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }

      // The edge was already in the target state — keep the flag, revert the ±1.
      if (isAlreadyReacted(res) || isAlreadyRemoved(res)) {
        setReactions(prevCount);
        syncReactionCache(nextReacted, prevCount);
        return;
      }

      syncReactionCache(nextReacted, nextCount);
    } catch (err) {
      setReacted(prevReacted);
      setReactions(prevCount);
      toast.error(err instanceof Error ? err.message : "Couldn't react.");
    }
  };

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await removeNoteAction({ noteId: data.id });
      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      queryClient.setQueriesData<InfiniteData<NotesResponse>>(
        { queryKey: queryKeys.notesRoot() },
        (current) => patchNote(current, data.id, () => null),
      );
      toast.success("Note removed.");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Couldn't remove note.");
    },
  });

  return (
    // Tilt lives outside the export element so saved images stay straight.
    <div
      className={cn(
        "transition-transform duration-300 hover:rotate-0",
        index % 2 === 0 ? "rotate-[0.5deg]" : "-rotate-[0.5deg]",
      )}
    >
      <div id={`umamin-${data.id}`}>
        {isAuthenticated && !data.isAnonymous && user && (
          <ReplyDrawer
            isOpen={replyOpen}
            setIsOpen={setReplyOpen}
            note={{ ...data, user }}
          />
        )}

        {canBlock && user && (
          <BlockUserDialog
            userId={user.id}
            username={username}
            open={blockOpen}
            onOpenChange={setBlockOpen}
            onBlocked={() => {
              // The user-blocks tag is already busted server-side; refetch so
              // the per-viewer overlay drops the blocked author's content.
              queryClient.invalidateQueries({
                queryKey: queryKeys.notesRoot(),
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.postsRoot(),
              });
            }}
          />
        )}

        {canModerate && (
          <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this note?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the note from the feed. You're acting
                  as a moderator.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    disabled={removeMutation.isPending}
                    variant="destructive"
                    onClick={() => removeMutation.mutate()}
                  >
                    Continue
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Card
          className={cn(
            "flex flex-col items-start justify-between",
            data.isAnonymous && "border-dashed",
            isHighlighted &&
              "ring-2 ring-orange-500 ring-offset-2 ring-offset-background motion-safe:animate-pulse",
          )}
        >
          <CardHeader className="w-full text-sm">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                {data.isAnonymous ? (
                  <Avatar>
                    <AvatarFallback>
                      <ScanFaceIcon />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Link
                    href={`/user/${username}`}
                    className="font-semibold relative"
                  >
                    <Avatar
                      className={cn({
                        "avatar-shine": hasUmaminPlus(user?.createdAt),
                      })}
                    >
                      <AvatarImage
                        className="rounded-full"
                        src={user?.imageUrl ?? ""}
                        alt="User avatar"
                      />
                      <AvatarFallback className="text-xs">
                        <ScanFaceIcon />
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                )}

                <div className="flex flex-col mt-1">
                  {data.isAnonymous ? (
                    <span className="text-muted-foreground text-base font-semibold leading-normal">
                      anonymous
                    </span>
                  ) : (
                    // The badge is its own link — a sibling, never nested
                    // inside the profile anchor.
                    <div className="flex items-center space-x-1">
                      <Link
                        href={`/user/${username}`}
                        className="flex items-center space-x-1"
                      >
                        <span className="font-semibold flex-none text-base leading-none">
                          {user?.displayName
                            ? user.displayName
                            : user?.username}
                        </span>
                        {username &&
                          process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(
                            ",",
                          ).includes(username) && (
                            <BadgeCheckIcon className="w-4 h-4 text-pink-500" />
                          )}
                      </Link>
                      <GroupBadge badge={user?.groupBadge} />
                    </div>
                  )}

                  {!data.isAnonymous && (
                    <span className="text-muted-foreground truncate">
                      @{username}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-x-1 text-muted-foreground items-center">
                {data.updatedAt && (
                  <span className="text-xs text-muted-foreground mr-1">
                    {shortTimeAgo(data.updatedAt)}
                  </span>
                )}

                {user?.quietMode && <MessageSquareXIcon className="size-5" />}

                {isAuthenticated && !data.isAnonymous && !user?.quietMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Reply"
                    aria-expanded={replyOpen}
                    onClick={() => setReplyOpen((prev) => !prev)}
                    className="size-auto p-0 hover:bg-transparent text-muted-foreground"
                  >
                    <MessageSquareTextIcon className="size-5" />
                  </Button>
                )}

                {isAuthenticated && (
                  <Menu
                    menuItems={[
                      {
                        title: "Reply",
                        onClick: () => setReplyOpen(true),
                        disabled: data.isAnonymous || !!user?.quietMode,
                        icon: <MessageSquareTextIcon className="h-4 w-4" />,
                      },
                      {
                        title: "Save Image",
                        onClick: () => saveImage(`umamin-${data.id}`),
                        icon: <DownloadIcon className="h-4 w-4" />,
                      },
                      ...(canBlock
                        ? [
                            {
                              title: username ? `Block @${username}` : "Block",
                              onClick: () => setBlockOpen(true),
                              className: "text-red-500",
                              icon: <UserXIcon className="h-4 w-4" />,
                            },
                          ]
                        : []),
                      ...(canModerate
                        ? [
                            {
                              title: "Remove note",
                              onClick: () => setRemoveOpen(true),
                              className: "text-red-600",
                              icon: <ShieldXIcon className="h-4 w-4" />,
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex w-full gap-3">
            <PostBody
              content={data.content}
              className="font-display text-lg leading-snug"
            />
          </CardContent>

          <CardFooter className="w-full pt-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!isAuthenticated}
              onClick={handleReact}
              aria-pressed={reacted}
              aria-label={reacted ? "Remove reaction" : "React to this note"}
              className={cn(
                "-ml-2 min-h-11 gap-1.5 px-2 hover:bg-transparent disabled:opacity-100",
                reacted
                  ? "text-orange-500 hover:text-orange-500"
                  : "text-muted-foreground",
              )}
            >
              <FlameIcon
                className={cn("size-5", reacted && "fill-orange-500")}
              />
              <span className="text-sm">{reactions}</span>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
