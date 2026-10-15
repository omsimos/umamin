import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import type { ReviewRequest } from "@/components/content-cover";
import { Uma } from "@/components/uma";

export type CoverKind =
  | "dispute"
  | "severe"
  | "scam"
  | "message"
  | "message-scam";

// Messages render as plain text, so only public content had links to turn off.
const SCAM_ADVICE =
  "Don't send anyone your password or a one-time code (OTP). I turned off the links in it so you can't open one by accident.";

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
  if (kind === "scam") {
    return {
      title: "Why is this covered?",
      lines: [
        `I covered this ${noun} for everyone because it looks like a scam, like free money, a prize, or a link that asks you to log in.`,
        SCAM_ADVICE,
        `Moderators review ${noun}s like this and remove the ones that break the rules. I'm automated, so if I got this one wrong, they can clear it.`,
      ],
      action: `View ${noun}`,
    };
  }
  if (kind === "message-scam") {
    return {
      title: "Why is this covered?",
      lines: [
        "You turned on Filter hurtful messages, and this one looks like a scam, like free money, a prize, or a link that asks you to log in.",
        "Don't send anyone your password or a one-time code (OTP), and don't open links from it.",
        "I'm automated, and I might be wrong about it. Only you see this cover.",
      ],
      action: "View message",
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
 * Uma's "Why?" sheet for a folded or covered item. A centered dialog at every
 * width: a bottom drawer on phones sat under the AdSense anchor ad, which hid
 * its last lines.
 */
export function UmaExplainer({
  kind,
  noun,
  open,
  onOpenChange,
  onReveal,
  dispute,
}: {
  kind: CoverKind;
  noun: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReveal: () => void;
  // Signed-in viewers of public content can tell a moderator Uma was wrong.
  dispute?: ReviewRequest;
}) {
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
      {dispute &&
        (dispute.sent ? (
          <p className="text-foreground">
            Thanks. A moderator will take a look.
          </p>
        ) : (
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-11 px-0 text-muted-foreground underline"
            disabled={dispute.pending}
            onClick={dispute.send}
          >
            Uma got this wrong
          </Button>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
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
