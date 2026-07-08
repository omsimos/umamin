"use client";

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
import { Button, buttonVariants } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { cn } from "@umamin/ui/lib/utils";
import { format } from "date-fns";
import {
  CheckCircle2Icon,
  CircleIcon,
  DownloadIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMessageAction } from "@/app/actions/message";
import { downloadCardImage, type ExportOrg } from "@/lib/export";
import type { ExportTheme } from "@/lib/export-themes";
import type { OrgMessageItem } from "@/lib/query-types";

export function MessageCard({
  message,
  org,
  theme,
  selected,
  onToggle,
  onDeleted,
}: {
  message: OrgMessageItem;
  org: ExportOrg;
  theme: ExportTheme;
  selected: boolean;
  onToggle: (message: OrgMessageItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, startDelete] = useTransition();
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  function del() {
    startDelete(async () => {
      const res = await deleteMessageAction(message.id);
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      onDeleted(message.id);
      toast.success("Message deleted");
    });
  }

  async function saveImage() {
    setSaving(true);
    try {
      await downloadCardImage(message, org, theme);
    } catch {
      toast.error("Couldn't generate image");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        "bg-card flex h-full flex-col rounded-xl border p-4 transition-shadow",
        selected && "ring-primary ring-2",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {message.question}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggle(message)}
          aria-label={selected ? "Deselect" : "Select"}
          aria-pressed={selected}
          className={cn(
            "-mt-1 -mr-1 size-7 shrink-0",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {selected ? (
            <CheckCircle2Icon className="size-5" />
          ) : (
            <CircleIcon className="size-5" />
          )}
        </Button>
      </div>

      {/* Content is truncated in the grid; clicking opens the full message. */}
      <Button
        variant="ghost"
        onClick={() => setDetailOpen(true)}
        aria-label="View full message"
        className="text-foreground -mx-2 mt-2 h-auto w-full justify-start rounded-md px-2 py-1 text-left font-normal whitespace-normal"
      >
        <span className="line-clamp-5 text-sm break-words whitespace-pre-wrap">
          {message.content}
        </span>
      </Button>

      <div className="mt-auto flex items-center justify-between pt-3">
        <span className="text-muted-foreground text-xs">
          {format(new Date(message.createdAt), "MMM d, yyyy")}
        </span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={saveImage}
            disabled={saving}
            aria-label="Save image"
            className="text-muted-foreground size-7"
          >
            {saving ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <DownloadIcon />
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={deleting}
                aria-label="Delete message"
                className="text-muted-foreground size-7"
              >
                {deleting ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <Trash2Icon />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={del}
                  className={buttonVariants({ variant: "destructive" })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{message.question}</DialogTitle>
            <DialogDescription>
              {format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted max-h-[55dvh] overflow-y-auto rounded-lg p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={saveImage} disabled={saving}>
              {saving ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <DownloadIcon />
              )}
              Save image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
