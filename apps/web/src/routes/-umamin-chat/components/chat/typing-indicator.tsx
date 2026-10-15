import { Bubble, BubbleContent } from "@umamin/ui/components/bubble";

export function TypingIndicator() {
  return (
    <Bubble variant="muted" role="status">
      <BubbleContent className="flex items-center gap-1 rounded-2xl px-3.5 py-3">
        <span className="sr-only">Partner is typing</span>
        {[0, 0.15, 0.3].map((delay) => (
          <span
            key={delay}
            aria-hidden
            className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full motion-reduce:animate-none"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </BubbleContent>
    </Bubble>
  );
}
