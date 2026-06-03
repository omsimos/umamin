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
import { Button } from "@umamin/ui/components/button";
import { LogOut, Shuffle } from "lucide-react";
import type { ReactNode } from "react";
import { SeedAvatar } from "../seed-avatar";
import { ThemeToggle } from "../theme-toggle";
import { Wordmark } from "./app-shell";

export function SessionRail({
  selfAlias,
  selfSeed,
  onNewMatch,
  onEndChat,
}: {
  selfAlias: string;
  selfSeed: string;
  onNewMatch: () => void;
  onEndChat: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <Wordmark />
        <ThemeToggle />
      </div>

      <div className="bg-card mt-1 mb-2 flex items-center gap-2 rounded-lg border p-2">
        <SeedAvatar
          seed={selfSeed}
          alias={selfAlias}
          className="size-7 text-xs"
        />
        <span className="truncate text-sm font-medium">{selfAlias}</span>
      </div>

      <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
        Session
      </p>
      <Button className="justify-start gap-2" onClick={onNewMatch}>
        <Shuffle />
        New match
      </Button>

      <ConfirmButton
        trigger={
          <Button variant="secondary" className="justify-start gap-2">
            <LogOut />
            End chat
          </Button>
        }
        title="End this chat?"
        description="The conversation will be gone for good. Nothing is saved."
        confirmLabel="End chat"
        onConfirm={onEndChat}
      />
    </div>
  );
}

function ConfirmButton({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
