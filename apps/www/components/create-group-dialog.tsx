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
import { useRouter } from "next/navigation";
import { type FormEventHandler, useState } from "react";
import { toast } from "sonner";
import { createGroupAction } from "@/app/actions/group";
import { GroupIconPicker } from "@/components/group-icon-picker";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import {
  createGroupSchema,
  formatGroupTag,
  GROUP_DESCRIPTION_MAX_LENGTH,
  GROUP_ICONS,
  GROUP_NAME_MAX_LENGTH,
  GROUP_TAG_LENGTH,
  type GroupAccent,
  type GroupIcon,
} from "@/lib/group";
import { vibrate } from "@/lib/haptics";
import { queryKeys } from "@/lib/query";

export function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const submit = useSingleFlightAction(createGroupAction);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [icon, setIcon] = useState<GroupIcon>(GROUP_ICONS[0]);
  const [accent, setAccent] = useState<GroupAccent | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      // safeParse surfaces the first message for instant feedback; the server
      // re-validates the raw values (description normalizes blank → null).
      const parsed = createGroupSchema.safeParse({
        name,
        description,
        tag,
        icon,
        accent,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
      }
      const res = await submit({ name, description, tag, icon, accent });
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res;
    },
    onSuccess: (res) => {
      vibrate();
      queryClient.invalidateQueries({ queryKey: queryKeys.userGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      toast.success("Group created.");
      onOpenChange(false);
      setName("");
      setDescription("");
      setTag("");
      setIcon(GROUP_ICONS[0]);
      setAccent(null);
      router.push(`/groups/${res.group.tag}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();
    if (mutation.isPending) return;
    mutation.mutate();
  };

  const tagValid = /^[A-Z0-9]{4}$/.test(formatGroupTag(tag));
  const canSubmit = !mutation.isPending && name.trim().length > 0 && tagValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>
            Pick a name and a 4-character tag. The tag can't be changed later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              maxLength={GROUP_NAME_MAX_LENGTH}
              placeholder="The Bros"
              autoComplete="off"
              disabled={mutation.isPending}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="group-tag">Tag</Label>
            <Input
              id="group-tag"
              value={tag}
              maxLength={GROUP_TAG_LENGTH}
              placeholder="BROS"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              disabled={mutation.isPending}
              onChange={(e) =>
                setTag(
                  e.target.value
                    .replace(/[^a-zA-Z0-9]/g, "")
                    .toUpperCase()
                    .slice(0, GROUP_TAG_LENGTH),
                )
              }
              className="font-mono tracking-widest uppercase"
            />
            <p className="text-xs text-muted-foreground">
              4 letters or numbers. Shows next to your name.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="group-description" className="gap-1">
              Description
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="group-description"
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

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {mutation.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              "Create group"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
