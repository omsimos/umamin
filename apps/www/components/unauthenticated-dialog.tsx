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
} from "@umamin/ui/components/alert-dialog";
import { Button } from "@umamin/ui/components/button";
import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

export default function UnauthenticatedDialog({
  isPending = false,
  onConfirm,
  onOpenChange,
  open,
}: {
  isPending?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-center">
            <TriangleAlertIcon className="w-4 h-4 mr-1 text-yellow-500" />
            You are not logged in
          </AlertDialogTitle>
          <AlertDialogDescription>
            Messages sent will not be saved in your inbox and you won&apos;t be
            able to see the reply from this user. Do you still want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <Button asChild variant="outline">
            <Link href="/login">Login</Link>
          </Button>
          <AlertDialogAction disabled={isPending} onClick={onConfirm}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
