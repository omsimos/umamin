import { type CSSProperties, useEffect, useState } from "react";
import type { SendEffect } from "../../lib/session/types";

const EFFECT_EMOJI: Record<SendEffect, string[]> = {
  confetti: ["🎉", "✨", "🎊"],
  hearts: ["💖", "💕", "❤️"],
  sparkles: ["✨", "💫", "⭐"],
  poof: ["💨", "🌫️", "✨"],
  golden: ["👑", "💛", "✨", "💖"],
};

const PARTICLE_COUNT = 24;
const EFFECT_DURATION_MS = 1800;

interface Particle {
  id: number;
  emoji: string;
  style: CSSProperties;
}

function makeParticles(effect: SendEffect): Particle[] {
  const emojis = EFFECT_EMOJI[effect];
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    emoji: emojis[i % emojis.length],
    style: {
      left: `${Math.random() * 100}%`,
      fontSize: `${18 + Math.random() * 18}px`,
      animation: "effect-particle var(--dur) ease-out var(--delay) forwards",
      "--dx": `${(Math.random() - 0.5) * 140}px`,
      "--dy": `${-40 - Math.random() * 55}vh`,
      "--rot": `${(Math.random() - 0.5) * 540}deg`,
      "--delay": `${Math.random() * 0.4}s`,
      "--dur": `${1 + Math.random() * 0.8}s`,
    } as CSSProperties,
  }));
}

export function SendEffectOverlay({
  effect,
  onDone,
}: {
  effect: SendEffect;
  onDone: () => void;
}) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Particles are randomized once per mount, not per render.
  const [particles] = useState(() => makeParticles(effect));

  // A timer (not animationend) finishes the effect — jsdom-safe, and the
  // reduced-motion path completes immediately without rendering anything.
  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 0 : EFFECT_DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      data-testid="send-effect-overlay"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute -bottom-8 opacity-0"
          style={p.style}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
