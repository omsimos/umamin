"use client";

import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";

export function DeleteButton({ confirmText }: { confirmText: string }) {
  const { pending } = useFormStatus();
  const queryClient = useQueryClient();

  return (
    <Button
      disabled={pending || confirmText !== "delete my account"}
      type="submit"
      variant="secondary"
      className="mt-3 w-full"
      onClick={() => {
        queryClient.clear();
      }}
    >
      {pending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
      Delete Account
    </Button>
  );
}
