"use client";

import { cn } from "@umamin/ui/lib/utils";
import {
  GROUP_ACCENTS,
  GROUP_ICONS,
  type GroupAccent,
  type GroupIcon,
} from "@/lib/group";
import { GROUP_ACCENT_CLASSES, GROUP_ICON_MAP } from "@/lib/group-icons";

export function GroupIconPicker({
  icon,
  accent,
  onIconChange,
  onAccentChange,
  disabled,
}: {
  icon: GroupIcon;
  accent: GroupAccent | null;
  onIconChange: (icon: GroupIcon) => void;
  onAccentChange: (accent: GroupAccent) => void;
  disabled?: boolean;
}) {
  const accentClass = accent ? GROUP_ACCENT_CLASSES[accent] : undefined;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-sm font-medium">Icon</p>
        <div className="grid grid-cols-8 gap-1">
          {GROUP_ICONS.map((name) => {
            const Icon = GROUP_ICON_MAP[name];
            const selected = name === icon;
            return (
              <button
                key={name}
                type="button"
                disabled={disabled}
                aria-label={name}
                aria-pressed={selected}
                onClick={() => onIconChange(name)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border transition-colors hover:bg-muted",
                  selected ? "border-pink-500 bg-muted" : "border-transparent",
                )}
              >
                <Icon className={cn("size-4", selected && accentClass)} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Color</p>
        <div className="flex gap-2">
          {GROUP_ACCENTS.map((name) => (
            <button
              key={name}
              type="button"
              disabled={disabled}
              aria-label={name}
              aria-pressed={accent === name}
              onClick={() => onAccentChange(name)}
              className={cn(
                "size-7 rounded-full border-2 transition-transform",
                GROUP_ACCENT_CLASSES[name],
                accent === name
                  ? "scale-110 border-current"
                  : "border-transparent",
              )}
            >
              <span className="block size-full rounded-full bg-current opacity-80" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
