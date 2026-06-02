export function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="Partner is typing"
      className="bg-muted flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm px-3.5 py-3"
    >
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="bg-muted-foreground size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
