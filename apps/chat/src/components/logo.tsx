export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/umamin-logo.png"
      alt=""
      aria-hidden
      draggable={false}
      className={className}
    />
  );
}
