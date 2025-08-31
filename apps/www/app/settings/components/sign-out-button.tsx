"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@umamin/ui/components/button";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      data-testid="logout-btn"
      type="submit"
      disabled={pending}
      variant="outline"
    >
      {pending && <Loader2Icon className="size-4 animate-spin" />}
      Sign Out
    </Button>
  );
}
