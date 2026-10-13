import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { Uma } from "@/components/uma";
import { useMediaQuery } from "@/hooks/use-media-query";

export type CoverKind = "dispute" | "severe" | "message";

function copyFor(kind: CoverKind, noun: string) {
  if (kind === "dispute") {
    return {
      title: "Why is this folded?",
      lines: [
        `Hi, I'm Uma. I fold ${noun}s that look like callouts, indirects, gossip or fights, so you can choose whether to read them.`,
        "I'm automated, and I get it wrong sometimes, often on sad or love posts. A fold doesn't mean anyone broke a rule, and nothing gets removed.",
        "To see everything, turn off Hide disputes in Settings, under Privacy.",
      ],
      action: `Show ${noun}`,
    };
  }
  if (kind === "severe") {
    return {
      title: "Why is this covered?",
      lines: [
        `I covered this ${noun} for everyone because it may contain slurs, threats or someone's private details.`,
        `Moderators review ${noun}s like this and remove the ones that break the rules. I'm automated, so if I got this one wrong, they can clear it.`,
        "You can still view it if you choose to.",
      ],
      action: `View ${noun}`,
    };
  }
  return {
    title: "Why is this covered?",
    lines: [
      "You turned on Filter hurtful messages, and this one looked hurtful, so I covered it.",
      "I'm automated, and I might be wrong about it. Only you see this cover.",
    ],
    action: "View message",
  };
}

/**
 * Uma's "Why?" sheet for a folded or covered item: a bottom drawer on phones,
 * a dialog on desktop (same split as the follow list).
 */
export function UmaExplainer({
  kind,
  noun,
  open,
  onOpenChange,
  onReveal,
}: {
  kind: CoverKind;
  noun: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReveal: () => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { title, lines, action } = copyFor(kind, noun);
  const mood = kind === "dispute" ? "calm" : "serious";

  const reveal = () => {
    onOpenChange(false);
    onReveal();
  };

  const [first, ...rest] = lines;
  const body = (
    <div className="space-y-2 text-sm text-muted-foreground">
      {rest.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
  const buttons = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
      >
        Close
      </Button>
      <Button type="button" onClick={reveal}>
        {action}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center sm:text-center">
            <Uma mood={mood} className="mb-2 size-20" />
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-foreground">
              {first}
            </DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter>{buttons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="items-center">
          <Uma mood={mood} className="mb-2 size-20" />
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="text-foreground">
            {first}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4">{body}</div>
        <DrawerFooter className="flex-col-reverse">{buttons}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
