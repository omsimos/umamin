"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import {
  CheckIcon,
  PlusIcon,
  SettingsIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { equipGroupBadgeAction } from "@/app/actions/group";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import {
  type GroupAccent,
  type GroupIcon,
  OWNED_GROUPS_CAP,
} from "@/lib/group";
import { GROUP_ACCENT_CLASSES, GROUP_ICON_MAP } from "@/lib/group-icons";
import { vibrate } from "@/lib/haptics";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchUserGroups,
} from "@/lib/query-fetchers";
import { hasUmaminPlus } from "@/lib/utils";

function GroupGlyph({ icon, accent }: { icon: string; accent: string | null }) {
  const Icon = GROUP_ICON_MAP[icon as GroupIcon] ?? UsersRoundIcon;
  const accentClass =
    accent && accent in GROUP_ACCENT_CLASSES
      ? GROUP_ACCENT_CLASSES[accent as GroupAccent]
      : "text-muted-foreground";
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
      <Icon className={cn("size-5", accentClass)} />
    </div>
  );
}

export function GroupsHub() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const equip = useSingleFlightAction(equipGroupBadgeAction);

  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const user = currentUser?.user ?? null;
  const isPlus = hasUmaminPlus(user?.createdAt);
  const equippedGroupId = user?.equippedGroupId ?? null;

  const { data: groups } = useQuery({
    queryKey: queryKeys.userGroups(),
    queryFn: fetchUserGroups,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const memberships = groups?.data ?? [];
  const ownsGroup = memberships.some((m) => m.role === "owner");

  const equipMutation = useMutation({
    mutationFn: async (groupId: string | null) => {
      const res = await equip({ groupId });
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res;
    },
    onSuccess: () => {
      vibrate();
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleEquip = (groupId: string) => {
    if (equipMutation.isPending) return;
    equipMutation.mutate(equippedGroupId === groupId ? null : groupId);
  };

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">
            Wear a group's tag next to your name.
          </p>
        </div>
        {isPlus && !ownsGroup ? (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <PlusIcon /> Create
          </Button>
        ) : null}
      </header>

      {!isPlus && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="font-medium">Create your own group with Umamin+</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Group creation is an Umamin+ perk — unlocked once your account is a
            year old. You can still join groups you're invited to and wear their
            tag.
          </p>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Your groups
        </h2>

        {memberships.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            You're not in any groups yet. Join one with an invite link.
          </p>
        ) : (
          <ul className="space-y-2">
            {memberships.map(({ group, role }) => {
              const equipped = equippedGroupId === group.id;
              return (
                <li
                  key={group.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <GroupGlyph icon={group.icon} accent={group.accent} />

                  <Link
                    href={`/groups/${group.tag}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{group.name}</span>
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {group.tag}
                      </Badge>
                      {role === "owner" && (
                        <span className="text-xs text-muted-foreground">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {group.memberCount}{" "}
                      {group.memberCount === 1 ? "member" : "members"}
                    </p>
                  </Link>

                  <Button
                    type="button"
                    size="sm"
                    variant={equipped ? "default" : "outline"}
                    disabled={equipMutation.isPending}
                    onClick={() => toggleEquip(group.id)}
                    aria-pressed={equipped}
                  >
                    {equipped ? (
                      <>
                        <CheckIcon /> Wearing
                      </>
                    ) : (
                      "Wear tag"
                    )}
                  </Button>

                  {role === "owner" && (
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      aria-label="Manage group"
                    >
                      <Link href={`/groups/${group.tag}`}>
                        <SettingsIcon />
                      </Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {isPlus && ownsGroup && memberships.length >= OWNED_GROUPS_CAP ? (
          <p className="text-xs text-muted-foreground">
            You can own one group.
          </p>
        ) : null}
      </section>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
