"use client";

import { Loader2Icon, LogOutIcon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@umamin/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";

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
