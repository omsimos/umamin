import { Button } from "@umamin/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { Switch } from "@umamin/ui/components/switch";
import { cn } from "@umamin/ui/lib/utils";
import { useId, useState } from "react";
import { DM_REPORT_REASONS } from "@/lib/dm/constants";
import type { DmReportReason } from "@/lib/dm/types";

const REASON_LABELS: Record<DmReportReason, string> = {
  harassment: "Harassment or bullying",
  sexual: "Sexual content",
  minor_safety: "A minor may be at risk",
  spam: "Spam or scam",
  other: "Something else",
};

/** Report one message. Moderators see it with the messages just before it. */
export function ReportDrawer({
  open,
  onOpenChange,
  peerName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerName: string;
  onSubmit: (reason: DmReportReason, block: boolean) => Promise<void>;
}) {
  const [reason, setReason] = useState<DmReportReason | null>(null);
  const [block, setBlock] = useState(false);
  const [pending, setPending] = useState(false);
  const blockId = useId();
  const reasonName = useId();

  async function submit() {
    if (!reason) return;
    setPending(true);
    try {
      await onSubmit(reason, block);
      onOpenChange(false);
      setReason(null);
      setBlock(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Report message</DrawerTitle>
          <DrawerDescription>
            Moderators will see this message and the ones just before it.{" "}
            {peerName} won't know who reported it.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-1 px-4">
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">Reason</legend>
            {DM_REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "has-[:focus-visible]:ring-ring/50 cursor-pointer rounded-lg border px-3 py-2.5 text-sm has-[:focus-visible]:ring-[3px]",
                  reason === r && "border-primary bg-primary/5 font-medium",
                )}
              >
                <input
                  type="radio"
                  name={reasonName}
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="sr-only"
                />
                {REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <label
            htmlFor={blockId}
            className="mt-2 flex items-center justify-between gap-3 py-2 text-sm"
          >
            Also block {peerName}
            <Switch id={blockId} checked={block} onCheckedChange={setBlock} />
          </label>
        </div>
        <DrawerFooter>
          <Button
            variant="destructive"
            disabled={!reason || pending}
            onClick={() => void submit()}
          >
            {pending ? "Sending…" : "Send report"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
