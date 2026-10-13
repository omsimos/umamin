import { cn } from "@umamin/ui/lib/utils";
import { blobatarUri } from "blobatar/uri";
import { useState } from "react";
import { GroupBadge } from "@/components/group-badge";
import {
  GROUP_MEMBER_CAP,
  type GroupAccent,
  type GroupIcon,
} from "@/lib/group";
import { GROUP_ACCENT_CLASSES, GROUP_ICON_MAP } from "@/lib/group-icons";

const ICONS: GroupIcon[] = [
  "coffee",
  "gamepad",
  "music",
  "moon",
  "flame",
  "cat",
];
const ACCENTS: GroupAccent[] = ["pink", "amber", "sky", "violet", "emerald"];
const MEMBERS = ["kape.at.ulan", "lakad.lang", "hindi.pa.tulog", "aral.mode"];

export function DemoGroups() {
  const [tag, setTag] = useState("BLKD");
  const [icon, setIcon] = useState<GroupIcon>("coffee");
  const [accent, setAccent] = useState<GroupAccent>("pink");
  const badge = { id: "demo", tag: tag.padEnd(4, "·"), icon, accent };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-xs text-muted-foreground">
          Tag
          <input
            value={tag}
            maxLength={4}
            onChange={(e) =>
              setTag(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
            }
            className="w-28 rounded-lg border bg-background px-3 py-2 font-mono text-base tracking-[0.3em] text-foreground uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <fieldset className="flex min-w-0 flex-wrap gap-1.5">
          <legend className="sr-only">Icon</legend>
          {ICONS.map((name) => {
            const Icon = GROUP_ICON_MAP[name];
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={icon === name}
                onClick={() => setIcon(name)}
                className={cn(
                  "grid size-9 place-items-center rounded-lg border transition-colors",
                  icon === name
                    ? "border-foreground bg-secondary"
                    : "hover:bg-muted",
                )}
              >
                <Icon className={cn("size-4", GROUP_ACCENT_CLASSES[accent])} />
              </button>
            );
          })}
        </fieldset>

        <fieldset className="flex min-w-0 gap-2">
          <legend className="sr-only">Color</legend>
          {ACCENTS.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={accent === name}
              onClick={() => setAccent(name)}
              className={cn(
                "grid size-7 place-items-center rounded-full border",
                accent === name &&
                  "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            >
              <span
                className={cn(
                  "size-3.5 rounded-full bg-current",
                  GROUP_ACCENT_CLASSES[name],
                )}
              />
            </button>
          ))}
        </fieldset>
      </div>

      <ul className="grid gap-2 rounded-xl border bg-background/60 p-3">
        {MEMBERS.map((member) => (
          <li key={member} className="flex items-center gap-2 text-sm">
            <img
              src={blobatarUri(member)}
              alt=""
              width={24}
              height={24}
              className="size-6 rounded-full bg-muted"
            />
            <span className="truncate font-medium">{member}</span>
            <GroupBadge badge={badge} linked={false} />
          </li>
        ))}
        <li className="pt-1 text-xs text-muted-foreground">
          {MEMBERS.length} of {GROUP_MEMBER_CAP} members
        </li>
      </ul>
    </div>
  );
}
