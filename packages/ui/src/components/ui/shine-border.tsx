"use client";

import { cn } from "../../lib/utils";

interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: string[] | string;
  className?: string;
  children: React.ReactNode;
}

export default function ShineBorder({
  borderRadius = 12,
  borderWidth = 1,
  duration = 14,
  color = "#fff",
  className,
  children,
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          "--border-radius": `${borderRadius}px`,
        } as React.CSSProperties
      }
      className={cn("relative rounded-[--border-radius]", className)}
    >
      <div
        style={
          {
            "--border-width": `${borderWidth}px`,
            "--border-radius": `${borderRadius}px`,
            "--border-radius-child": `${borderRadius * 0.2}px`,
            "--shine-pulse-duration": `${duration}s`,
            "--mask-linear-gradient": `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            "--background-radial-gradient": `radial-gradient(transparent,transparent, ${!(color instanceof Array) ? color : color.join(",")},transparent,transparent)`,
          } as React.CSSProperties
        }
        className={`before:bg-shine-size before:absolute before:inset-[0] before:aspect-square before:h-full before:w-full before:rounded-[--border-radius] before:p-[--border-width] before:will-change-[background-position] before:content-[""] before:![-webkit-mask-composite:xor] before:[background-image:var(--background-radial-gradient)] before:[background-size:300%_300%] before:![mask-composite:exclude] before:[mask:var(--mask-linear-gradient)] motion-safe:before:animate-[shine-pulse_var(--shine-pulse-duration)_infinite_linear] pointer-events-none opacity-20`}
      ></div>
      <div className={"h-full w-full rounded-[--border-radius-child]"}>
        {children}
      </div>
    </div>
  );
}
