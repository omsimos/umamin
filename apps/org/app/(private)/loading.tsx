import { Loader2Icon } from "lucide-react";

export default function Loading() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-24 text-sm">
      <Loader2Icon className="animate-spin" aria-hidden />
      Loading…
    </div>
  );
}
