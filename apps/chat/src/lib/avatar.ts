const PALETTE = [
  ["#db2777", "#7c3aed"],
  ["#0ea5e9", "#22c55e"],
  ["#f59e0b", "#ef4444"],
  ["#8b5cf6", "#ec4899"],
  ["#06b6d4", "#3b82f6"],
  ["#10b981", "#84cc16"],
  ["#f43f5e", "#f97316"],
  ["#6366f1", "#a855f7"],
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarGradient(seed: string): { backgroundImage: string } {
  const h = hash(seed);
  const [from, to] = PALETTE[h % PALETTE.length];
  const angle = 90 + (h % 180);
  return { backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})` };
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
