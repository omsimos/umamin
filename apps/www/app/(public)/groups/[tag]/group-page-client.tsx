"use client";

import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@umamin/ui/components/alert-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import { Input } from "@umamin/ui/components/input";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  CheckIcon,
  EllipsisIcon,
  Loader2Icon,
  MessageCircleIcon,
  MessageCircleOffIcon,
  ScanFaceIcon,
  SquarePenIcon,
  TagIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEventHandler, useState } from "react";
import { toast } from "sonner";
import {
  cancelJoinRequestAction,
  deleteGroupAction,
  equipGroupBadgeAction,
  inviteToGroupAction,
  kickGroupMemberAction,
  leaveGroupAction,
  requestToJoinGroupAction,
  respondToInviteAction,
  respondToJoinRequestAction,
} from "@/app/actions/group";
import { GroupEditDialog } from "@/components/group-edit-dialog";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import {
  GROUP_CHAT_ENABLED,
  type GroupAccent,
  type GroupIcon,
} from "@/lib/group";
import { GROUP_ACCENT_CLASSES, GROUP_ICON_MAP } from "@/lib/group-icons";
import { vibrate } from "@/lib/haptics";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchGroup,
  fetchGroupMembersPage,
  fetchGroupRequestsPage,
  fetchGroupViewer,
} from "@/lib/query-fetchers";
import type {
  GroupMembersResponse,
  GroupPageData,
  GroupRequestsResponse,
} from "@/lib/query-types";

export function GroupPageClient({
  tag,
  initialGroup,
}: {
  tag: string;
  initialGroup: GroupPageData;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: group } = useQuery({
    queryKey: queryKeys.group(tag),
    queryFn: () => fetchGroup(tag),
    initialData: initialGroup,
    staleTime: PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const { data: viewer } = useQuery({
    queryKey: queryKeys.groupViewer(tag),
    queryFn: () => fetchGroupViewer(tag),
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const relationship = viewer?.relationship ?? null;
  const isOwner = relationship === "owner";
  const isMember = relationship === "owner" || relationship === "member";
  const isInvited = relationship === "invited";
  const isRequested = relationship === "requested";
  const isAuthenticated = viewer?.isAuthenticated ?? Boolean(currentUser?.user);
  const currentUserId = currentUser?.user?.id ?? null;
  const equippedGroupId = currentUser?.user?.equippedGroupId ?? null;

  const members = useInfiniteQuery<GroupMembersResponse>({
    queryKey: queryKeys.groupMembers(tag),
    queryFn: ({ pageParam }) =>
      fetchGroupMembersPage(tag, (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isMember,
    staleTime: PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const requests = useInfiniteQuery<GroupRequestsResponse>({
    queryKey: queryKeys.groupRequests(tag),
    queryFn: ({ pageParam }) =>
      fetchGroupRequestsPage(tag, (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isOwner,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const refreshMembership = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.groupViewer(tag) });
    queryClient.invalidateQueries({ queryKey: queryKeys.group(tag) });
    queryClient.invalidateQueries({ queryKey: queryKeys.userGroups() });
  };

  const equip = useSingleFlightAction(equipGroupBadgeAction);
  const equipped = equippedGroupId === group?.id;
  const equipMutation = useMutation({
    mutationFn: async () => {
      const res = await equip({
        groupId: equipped ? null : (group?.id ?? null),
      });
      if ("error" in res) throw new Error(res.error);
    },
    onSuccess: () => {
      vibrate();
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
    },
    onError: (err) => toast.error(err.message),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await leaveGroupAction({ groupId: group?.id ?? "" });
      if (res && "error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      refreshMembership();
      toast.success("You left the group.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await deleteGroupAction({ groupId: group?.id ?? "" });
      if (res && "error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      toast.success("Group deleted.");
      window.location.assign("/groups");
    },
    onError: (err) => toast.error(err.message),
  });

  const kickMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await kickGroupMemberAction({
        groupId: group?.id ?? "",
        userId,
      });
      if (res && "error" in res && res.error) throw new Error(res.error);
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.setQueryData<InfiniteData<GroupMembersResponse>>(
        queryKeys.groupMembers(tag),
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              data: page.data.filter((m) => m.user.id !== userId),
            })),
          },
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.group(tag) });
      toast.success("Member removed.");
    },
    onError: (err) => toast.error(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await inviteToGroupAction({
        groupId: group?.id ?? "",
        username,
      });
      if (res && "error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      const accepted = res && "accepted" in res && res.accepted;
      toast.success(accepted ? "Added to the group." : "Invite sent.");
      setInviteUsername("");
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.group(tag) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(tag) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupRequests(tag) });
    },
    onError: (err) => toast.error(err.message),
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await requestToJoinGroupAction({ groupId: group?.id ?? "" });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      const joined = "joined" in res && res.joined;
      if (joined) vibrate();
      toast.success(joined ? "You're in!" : "Request sent.");
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      refreshMembership();
      if (joined) router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await cancelJoinRequestAction({ groupId: group?.id ?? "" });
      if (res && "error" in res && res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Request withdrawn.");
      refreshMembership();
    },
    onError: (err) => toast.error(err.message),
  });

  const respondInviteMutation = useMutation({
    mutationFn: async (accept: boolean) => {
      const res = await respondToInviteAction({
        groupId: group?.id ?? "",
        accept,
      });
      if (res && "error" in res && res.error) throw new Error(res.error);
      return accept;
    },
    onSuccess: (accept) => {
      if (accept) vibrate();
      toast.success(accept ? "You're in!" : "Invite declined.");
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      refreshMembership();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const respondRequestMutation = useMutation({
    mutationFn: async ({
      userId,
      accept,
    }: {
      userId: string;
      accept: boolean;
    }) => {
      const res = await respondToJoinRequestAction({
        groupId: group?.id ?? "",
        userId,
        accept,
      });
      if (res && "error" in res && res.error) throw new Error(res.error);
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.setQueryData<InfiniteData<GroupRequestsResponse>>(
        queryKeys.groupRequests(tag),
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              data: page.data.filter((r) => r.user.id !== userId),
            })),
          },
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.group(tag) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(tag) });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleInvite: FormEventHandler = (e) => {
    e.preventDefault();
    const username = inviteUsername.trim();
    if (!username || inviteMutation.isPending) return;
    inviteMutation.mutate(username);
  };

  if (!group) {
    return null;
  }

  const Icon = GROUP_ICON_MAP[group.icon as GroupIcon] ?? UsersRoundIcon;
  const accentClass =
    group.accent && group.accent in GROUP_ACCENT_CLASSES
      ? GROUP_ACCENT_CLASSES[group.accent as GroupAccent]
      : "text-muted-foreground";

  const memberRows = members.data?.pages.flatMap((page) => page.data) ?? [];
  const requestRows = requests.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className={cn("size-8", accentClass)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{group.name}</h1>
            <Badge variant="secondary" className="font-mono">
              {group.tag}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </p>
          {group.creator && (
            <p className="text-xs text-muted-foreground">
              Created{" "}
              {formatDistanceToNow(group.createdAt, { addSuffix: true })} by{" "}
              <Link
                href={`/user/${group.creator.username}`}
                className="hover:underline"
              >
                {group.creator.displayName ?? group.creator.username}
              </Link>
            </p>
          )}
        </div>
      </header>

      {group.description && (
        <p className="text-sm whitespace-pre-wrap break-words">
          {group.description}
        </p>
      )}

      {isMember && (
        <div className="space-y-2">
          {/* Open chat is the sole primary action; the tag toggle stays
              secondary so two filled CTAs never compete. While chat is off it's
              a quiet notice (not a CTA), leaving the tag toggle as the action. */}
          {GROUP_CHAT_ENABLED ? (
            <Button asChild className="w-full">
              <Link href={`/groups/${tag}/chat`}>
                <MessageCircleIcon /> Open chat
              </Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <MessageCircleOffIcon className="size-4 shrink-0" />
              <span>Group chat is temporarily unavailable.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant={equipped ? "secondary" : "outline"}
              className="flex-1"
              disabled={equipMutation.isPending}
              onClick={() => equipMutation.mutate()}
              aria-pressed={equipped}
            >
              {equipped ? (
                <>
                  <CheckIcon /> Wearing tag
                </>
              ) : (
                <>
                  <TagIcon /> Wear tag
                </>
              )}
            </Button>

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Manage group"
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => setInviteOpen(true)}>
                    <UserPlusIcon /> Invite members
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    <SquarePenIcon /> Edit group
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2Icon /> Delete group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {relationship === "member" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={leaveMutation.isPending}>
                    Leave
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave this group?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your tag will be removed and you'll need a new invite to
                      rejoin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => leaveMutation.mutate()}>
                      Leave
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}

      {/* Non-member CTAs: invited (accept/decline), requested (pending), or
          can request to join. */}
      {!isMember && (
        <div className="rounded-lg border bg-muted/40 p-4">
          {!isAuthenticated ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="font-medium underline">
                Log in
              </Link>{" "}
              to join this group.
            </p>
          ) : isInvited ? (
            <div className="space-y-3">
              <p className="text-sm">
                You've been invited to join.{" "}
                <span className="text-muted-foreground">
                  Your tag is visible on everything you post.
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={respondInviteMutation.isPending}
                  onClick={() => respondInviteMutation.mutate(true)}
                >
                  Accept invite
                </Button>
                <Button
                  variant="outline"
                  disabled={respondInviteMutation.isPending}
                  onClick={() => respondInviteMutation.mutate(false)}
                >
                  Decline
                </Button>
              </div>
            </div>
          ) : isRequested ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Your request to join is pending.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={cancelRequestMutation.isPending}
                onClick={() => cancelRequestMutation.mutate()}
              >
                Withdraw
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Ask to join — the owner will review your request.
              </p>
              <Button
                disabled={requestMutation.isPending}
                onClick={() => requestMutation.mutate()}
              >
                Request to join
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Pending join requests — owner only. */}
      {isOwner && requestRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Requests ({requestRows.length})
          </h2>
          <ul className="divide-y">
            {requestRows.map((request) => (
              <li key={request.id} className="flex items-center gap-3 py-3">
                <Avatar className="size-9">
                  <AvatarImage src={request.user.imageUrl ?? ""} alt="" />
                  <AvatarFallback>
                    <ScanFaceIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <Link
                  href={`/user/${request.user.username}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate font-medium">
                    {request.user.displayName ?? request.user.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{request.user.username}
                  </span>
                </Link>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Approve ${request.user.username}`}
                  disabled={respondRequestMutation.isPending}
                  onClick={() =>
                    respondRequestMutation.mutate({
                      userId: request.user.id,
                      accept: true,
                    })
                  }
                  className="text-muted-foreground hover:text-emerald-500"
                >
                  <CheckIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Reject ${request.user.username}`}
                  disabled={respondRequestMutation.isPending}
                  onClick={() =>
                    respondRequestMutation.mutate({
                      userId: request.user.id,
                      accept: false,
                    })
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          {requests.hasNextPage && (
            <Button
              variant="ghost"
              className="w-full"
              disabled={requests.isFetchingNextPage}
              onClick={() => requests.fetchNextPage()}
            >
              {requests.isFetchingNextPage ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                "Show more"
              )}
            </Button>
          )}
        </section>
      )}

      {isMember && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Members</h2>

          {members.isLoading ? (
            <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading members…
            </p>
          ) : memberRows.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Couldn't load members right now.
            </p>
          ) : null}

          <ul className="divide-y">
            {memberRows.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-3">
                <Avatar className="size-9">
                  <AvatarImage src={member.user.imageUrl ?? ""} alt="" />
                  <AvatarFallback>
                    <ScanFaceIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <Link
                  href={`/user/${member.user.username}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate font-medium">
                    {member.user.displayName ?? member.user.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{member.user.username}
                  </span>
                </Link>
                {member.role === "owner" ? (
                  <Badge variant="outline" className="text-[10px]">
                    Owner
                  </Badge>
                ) : isOwner && member.user.id !== currentUserId ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${member.user.username}`}
                    disabled={kickMutation.isPending}
                    onClick={() => kickMutation.mutate(member.user.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <UserMinusIcon className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>

          {members.hasNextPage && (
            <Button
              variant="ghost"
              className="w-full"
              disabled={members.isFetchingNextPage}
              onClick={() => members.fetchNextPage()}
            >
              {members.isFetchingNextPage ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                "Show more"
              )}
            </Button>
          )}
        </section>
      )}

      {/* Owners are the only ones who can invite, so the dialog (and its Radix
          bundle work) is only mounted for them. */}
      {isOwner && (
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Invite a member</DialogTitle>
              <DialogDescription>
                Enter a username to invite. They'll get a notification to
                accept.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                value={inviteUsername}
                placeholder="username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
                disabled={inviteMutation.isPending}
                onChange={(e) =>
                  setInviteUsername(e.target.value.replace(/^@/, "").trim())
                }
              />
              <Button
                type="submit"
                disabled={inviteMutation.isPending || !inviteUsername.trim()}
              >
                {inviteMutation.isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  "Invite"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isOwner && editOpen && (
        <GroupEditDialog
          group={group}
          routeTag={tag}
          onClose={() => setEditOpen(false)}
        />
      )}

      {isOwner && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this group?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the tag from all {group.memberCount} members and
                can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete group
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
