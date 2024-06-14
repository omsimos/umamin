"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@umamin/ui/components/button";

export function RegisterButton() {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button disabled={pending} type="submit" className="w-full">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create an account
      </Button>

      <Button disabled={pending} variant="outline" asChild>
        <Link href="/login/google" className="mt-4 w-full">
          Continue with Google
        </Link>
      </Button>
    </div>
  );
}
