export function TypingIndicator() {
  return (
    <div
      role="status"
      className="bg-muted flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm px-3.5 py-3"
    >
      <span className="sr-only">Partner is typing</span>
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
