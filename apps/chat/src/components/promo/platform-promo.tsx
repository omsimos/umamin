import { Button } from "@umamin/ui/components/button";
import { ArrowRight } from "lucide-react";
import { umaminUrl } from "../../lib/links";
import { Logo } from "../logo";

export function PlatformPromo() {
  return (
    <div className="border-primary/20 bg-primary/5 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Logo className="size-4" />
        Your own anon inbox
      </p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        Get encrypted anonymous messages on your own profile.
      </p>
      <Button asChild size="sm" className="mt-3 w-full">
        <a
          href={umaminUrl("sidebar")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get your inbox
          <ArrowRight />
        </a>
      </Button>
    </div>
  );
}
