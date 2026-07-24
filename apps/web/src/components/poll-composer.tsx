"use client";

import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import { Input } from "@umamin/ui/components/input";
import { ClockIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import {
  POLL_DURATION_LABELS,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  type PollDuration,
} from "@/lib/poll";

type PollComposerProps = {
  options: string[];
  duration: PollDuration;
  onOptionsChange: (options: string[]) => void;
  onDurationChange: (duration: PollDuration) => void;
  onRemove: () => void;
};

export function PollComposer({
  options,
  duration,
  onOptionsChange,
  onDurationChange,
  onRemove,
}: PollComposerProps) {
  const setOption = (index: number, value: string) => {
    onOptionsChange(options.map((opt, i) => (i === index ? value : opt)));
  };

  const removeOption = (index: number) => {
    onOptionsChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-muted p-3 space-y-2">
      {options.map((option, index) => (
        <div
          // Options have no stable identity while editing; order never
          // changes except by removal, so the index is the identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: positional rows
          key={index}
          className="flex items-center gap-2"
        >
          <Input
            value={option}
            onChange={(e) => setOption(index, e.target.value)}
            placeholder={`Option ${index + 1}`}
            maxLength={POLL_OPTION_MAX_LENGTH}
            aria-label={`Poll option ${index + 1}`}
          />
          {options.length > POLL_MIN_OPTIONS && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove option ${index + 1}`}
              onClick={() => removeOption(index)}
              className="text-muted-foreground"
            >
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1">
          {options.length < POLL_MAX_OPTIONS && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOptionsChange([...options, ""])}
              className="text-pink-500 hover:text-pink-600"
            >
              <PlusIcon className="size-4" />
              Add option
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                <ClockIcon className="size-4" />
                {POLL_DURATION_LABELS[duration]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={duration}
                onValueChange={(value) =>
                  onDurationChange(value as PollDuration)
                }
              >
                {POLL_DURATIONS.map((preset) => (
                  <DropdownMenuRadioItem key={preset} value={preset}>
                    {POLL_DURATION_LABELS[preset]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove poll"
          onClick={onRemove}
          className="text-red-500 hover:text-red-600"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
