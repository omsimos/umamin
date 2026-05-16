"use client";

import { Button } from "@umamin/ui/components/button";
import { Loader2Icon } from "lucide-react";

export function DeleteButton({
  confirmText,
  isPending,
}: {
  confirmText: string;
  isPending: boolean;
}) {
  return (
    <Button
      disabled={isPending || confirmText !== "delete my account"}
      type="submit"
      variant="secondary"
      className="mt-3 w-full"
    >
      {isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
      Delete Account
    </Button>
  );
}
