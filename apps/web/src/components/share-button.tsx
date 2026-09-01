import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import { IdCardIcon, Link2Icon, Share2Icon } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";
import { captureException } from "@/lib/posthog";
import type { ProfileCardUser } from "@/lib/share-card/profile-card";
import { ProfileCardShare } from "./profile-card-share";

// A dismissed native share sheet rejects with AbortError — a user choice, not a
// failure, so it must never mint an issue.
function isShareAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export async function shareProfile(username: string) {
  if (typeof window === "undefined") return;
  const url = `${window.location.origin}/user/${username}`;

  try {
    if (
      navigator.share &&
      navigator.canShare({ url }) &&
      import.meta.env.PROD
    ) {
      await navigator.share({ url });
    } else {
      // Awaited: an un-awaited write shows the success toast even when the
      // clipboard write is denied.
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied.");
    }
  } catch (err) {
    if (isShareAbort(err)) return;
    captureException(err, { source: "share" });
    toast.error("Couldn't share the link.");
  }
}

export function ShareButton({
  username,
  variant = "ghost",
  className,
}: {
  username: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-label="Share profile"
      // Icon inherits the button's text color (currentColor) so callers can
      // tune it via className — muted on /to, default-foreground on the banner.
      className={className}
      onClick={() => void shareProfile(username)}
    >
      <Share2Icon className="size-4" />
    </Button>
  );
}

/** The own-profile share: a dropdown with the story-size profile card and a
 *  plain copy-link, replacing the bare share button on the banner. */
export function ProfileShareMenu({
  user,
  className,
}: {
  user: ProfileCardUser;
  className?: string;
}) {
  const [cardOpen, setCardOpen] = useState(false);

  async function copyProfileUrl() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/user/${user.username}`,
      );
      toast.success("Profile link copied.");
    } catch (err) {
      if (isShareAbort(err)) return;
      captureException(err, { source: "share" });
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Share profile"
            className={className}
          >
            <Share2Icon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setCardOpen(true)}>
            <span className="flex items-center gap-2">
              <IdCardIcon className="size-4" />
              Share your card
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copyProfileUrl()}>
            <span className="flex items-center gap-2">
              <Link2Icon className="size-4" />
              Copy link
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileCardShare
        user={user}
        open={cardOpen}
        onOpenChange={setCardOpen}
      />
    </>
  );
}
