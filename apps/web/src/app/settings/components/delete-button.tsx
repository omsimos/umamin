"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@umamin/ui/components/button";

export function DeleteButton({ confirmText }: { confirmText: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      disabled={pending || confirmText !== "delete my account"}
      type="submit"
      variant="secondary"
      className="mt-3 w-full"
    >
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Delete Account
    </Button>
  );
}
