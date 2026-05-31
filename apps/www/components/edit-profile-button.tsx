import { Button } from "@umamin/ui/components/button";
import { SquarePenIcon } from "lucide-react";
import Link from "next/link";

// Top-right action for your own UserCard (profile + inbox) — links to settings.
export function EditProfileButton() {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href="/settings">
        <SquarePenIcon />
        Edit profile
      </Link>
    </Button>
  );
}
