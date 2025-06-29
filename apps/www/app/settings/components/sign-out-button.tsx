"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      data-testid="logout-btn"
      type="submit"
      disabled={pending}
      variant="outline"
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      Sign Out
    </Button>
  );
}
