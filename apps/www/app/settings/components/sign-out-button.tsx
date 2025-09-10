"use client";

import { Loader2Icon, LogOutIcon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@umamin/ui/components/button";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} variant="outline">
      {pending ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />}
      Sign Out
    </Button>
  );
}
