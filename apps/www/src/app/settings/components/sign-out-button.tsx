"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@umamin/ui/components/button";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} variant="outline">
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Sign Out
    </Button>
  );
}
