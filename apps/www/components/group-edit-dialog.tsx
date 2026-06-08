"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2Icon } from "lucide-react";
import { type FormEventHandler, useState } from "react";
import { toast } from "sonner";
import { updateGroupAction } from "@/app/actions/group";
import { GroupIconPicker } from "@/components/group-icon-picker";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import {
  GROUP_DESCRIPTION_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  type GroupAccent,
  type GroupIcon,
  updateGroupSchema,
} from "@/lib/group";
import { vibrate } from "@/lib/haptics";
import { queryKeys } from "@/lib/query";

type EditableGroup = {
  id: string;
  name: string;
  description: string | null;
  tag: string;
  icon: string;
  accent: string | null;
};

// Owner-only group edit. Mount conditionally (`{open && <GroupEditDialog/>}`)
// so each open starts from the current values. The tag is immutable, shown
// read-only.
export function GroupEditDialog({
  group,
  routeTag,
  onClose,
}: {
  group: EditableGroup;
  // The route param the group page keyed its query on — invalidate it on save.
  routeTag: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const submit = useSingleFlightAction(updateGroupAction);

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [icon, setIcon] = useState<GroupIcon>(group.icon as GroupIcon);
  const [accent, setAccent] = useState<GroupAccent | null>(
    group.accent as GroupAccent | null,
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = updateGroupSchema.safeParse({
        groupId: group.id,
        name,
        description,
        icon,
        accent,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
      }
      const res = await submit({
        groupId: group.id,
        name,
        description,
        icon,
        accent,
      });
      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      vibrate();
      queryClient.invalidateQueries({ queryKey: queryKeys.group(routeTag) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      toast.success("Group updated.");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();
    if (mutation.isPending) return;
    mutation.mutate();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
          <DialogDescription>
            Update your group's name, description, and look. The tag is
            permanent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="edit-group-name">Name</Label>
            <Input
              id="edit-group-name"
              value={name}
              maxLength={GROUP_NAME_MAX_LENGTH}
              autoComplete="off"
              disabled={mutation.isPending}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-group-tag">Tag</Label>
            <Input
              id="edit-group-tag"
              value={group.tag}
              readOnly
              disabled
              className="font-mono tracking-widest uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Tags can't be changed.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-group-description" className="gap-1">
              Description
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="edit-group-description"
              value={description}
              maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
              placeholder="What's this group about?"
              rows={2}
              disabled={mutation.isPending}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <GroupIconPicker
            icon={icon}
            accent={accent}
            onIconChange={setIcon}
            onAccentChange={setAccent}
            disabled={mutation.isPending}
          />

          <Button
            type="submit"
            disabled={mutation.isPending || name.trim().length === 0}
            className="w-full"
          >
            {mutation.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
