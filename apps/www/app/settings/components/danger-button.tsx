"use client";

import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

export function DeleteButton({ confirmText }: { confirmText: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      disabled={pending || confirmText !== "delete my account"}
      type="submit"
      variant="secondary"
      className="mt-3 w-full"
    >
      {pending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
      Delete Account
    </Button>
  );
}
