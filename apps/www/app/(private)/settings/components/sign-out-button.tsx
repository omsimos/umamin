"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SignOutButton() {
  const { pending } = useFormStatus();
  const queryClient = useQueryClient();

  return (
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      onClick={() => {
        queryClient.clear();
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />}
      Sign Out
    </Button>
  );
}
