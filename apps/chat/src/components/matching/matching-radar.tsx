import { Button } from "@umamin/ui/components/button";
import { interestById } from "../../lib/mock/data";

export function MatchingRadar({
  interests,
  tip,
  onCancel,
}: {
  interests: string[];
  tip: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-7 flex size-32 items-center justify-center">
        <span className="border-primary absolute size-32 animate-ping rounded-full border opacity-60" />
        <span
          className="border-primary absolute size-24 animate-ping rounded-full border opacity-40"
          style={{ animationDelay: "0.5s" }}
        />
        <span
          className="from-primary size-16 rounded-full bg-gradient-to-br to-purple-600 shadow-lg"
          style={{ boxShadow: "0 0 28px var(--primary)" }}
        />
      </div>

      <p className="text-lg font-bold">Finding someone for you…</p>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {(interests.length > 0 ? interests : ["anyone"]).map((id) => {
          const it = interestById(id);
          return (
            <span
              key={id}
              className="border-primary/30 bg-primary/10 text-primary rounded-full border px-2.5 py-0.5 text-[11px]"
            >
              {it ? `${it.emoji} ${it.label}` : "Anyone"}
            </span>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-5 max-w-xs text-xs">
        <span className="font-medium">Tip:</span> {tip}
      </p>

      <Button
        variant="outline"
        className="mt-6 rounded-full"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
