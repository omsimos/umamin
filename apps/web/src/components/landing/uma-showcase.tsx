import { Button } from "@umamin/ui/components/button";
import { Switch } from "@umamin/ui/components/switch";
import { blobatarUri } from "blobatar/uri";
import { useState } from "react";
import { Uma } from "@/components/uma";
import { type CoverKind, UmaExplainer } from "@/components/uma-explainer";

type Line = "hello" | "shown" | "off" | "on" | "viewed";

const LINES: Record<Line, string> = {
  hello:
    "Hi, I'm Uma! I folded a post that looks like a callout. Open it if you want, it's your call.",
  shown: "Your call! I just like a calm feed.",
  off: "Okay, no more folding. I'll still cover the really hurtful stuff.",
  on: "Folding's back on. Less drama, more moon posts.",
  viewed:
    "That one stays covered for everyone until they tap. I can be wrong, so people decide what gets removed.",
};

function Author({ user, time }: { user: string; time: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <img
        src={blobatarUri(user)}
        alt=""
        width={28}
        height={28}
        className="size-7 rounded-full bg-muted"
      />
      <span className="font-semibold">{user}</span>
      <span className="text-muted-foreground">{time}</span>
    </div>
  );
}

/**
 * A three-post feed that behaves like the real covers, with Uma commenting on
 * each move: the ordinary post passes, the dispute folds while Hide disputes
 * is on, the severe post stays covered, and Why? opens the same explainer the
 * app uses. Uma turns serious after the severe post is opened, as it does on
 * real severe covers.
 */
export function UmaShowcase() {
  const [hideDisputes, setHideDisputes] = useState(true);
  const [shown, setShown] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [why, setWhy] = useState<CoverKind | null>(null);
  const [line, setLine] = useState<Line>("hello");

  const showDispute = () => {
    setShown(true);
    setLine("shown");
  };
  const viewSevere = () => {
    setViewed(true);
    setLine("viewed");
  };

  return (
    <div className="rounded-3xl border bg-card p-4 shadow-xl sm:p-5">
      <div className="flex items-end gap-3">
        <Uma
          key={line}
          mood={line === "viewed" ? "serious" : "calm"}
          className="size-12 animate-heart-pop motion-reduce:animate-none"
        />
        {/* The live region stays mounted; a region inserted together with
            its text is often not announced. */}
        <div aria-live="polite" className="flex-1">
          <p
            key={line}
            className="min-h-14 animate-reveal-pop rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm motion-reduce:animate-none"
          >
            {LINES[line]}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <article className="rounded-2xl border bg-background/60 p-4">
          <Author user="hindi.pa.tulog" time="1h" />
          <p className="mt-3 text-sm">
            the moon is so pretty tonight, go look outside
          </p>
        </article>

        <article className="rounded-2xl border bg-background/60 p-4">
          <Author user="lowkey.mad" time="3h" />
          {hideDisputes && !shown ? (
            <div className="mt-2 flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <Uma className="size-5" />
              <p className="flex-1 truncate">Folded: possible callout</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="underline underline-offset-4"
                onClick={() => setWhy("dispute")}
              >
                Why?
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={showDispute}
              >
                Show
              </Button>
            </div>
          ) : (
            <p className="mt-3 animate-reveal-pop text-sm">
              funny how some people act so sweet in person then talk about you
              in the gc. you know who you are
            </p>
          )}
        </article>

        <article className="rounded-2xl border bg-background/60 p-4">
          <Author user="anon_1427" time="3h" />
          {viewed ? (
            <p className="mt-3 animate-reveal-pop text-sm text-muted-foreground italic">
              On Umamin, this is where the post would show. It's left out of
              this demo.
            </p>
          ) : (
            <div className="relative mt-2 min-h-32">
              <p aria-hidden className="select-none pt-1 text-sm blur-md">
                This text is blurred. It stands in for a post that may contain
                slurs, threats or someone's private details, and the same cover
                shows for every viewer.
              </p>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <Uma mood="serious" className="size-8" />
                <p className="text-sm font-medium">
                  This post may contain hurtful content.
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground underline underline-offset-4"
                    onClick={() => setWhy("severe")}
                  >
                    Why?
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={viewSevere}
                  >
                    View
                  </Button>
                </div>
              </div>
            </div>
          )}
        </article>
      </div>

      <label
        htmlFor="uma-hide-disputes"
        className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-muted/60 px-4 py-3"
      >
        <span className="text-sm">
          <span className="block font-medium">Hide disputes</span>
          <span className="text-muted-foreground">
            The same switch is in Settings
          </span>
        </span>
        <Switch
          id="uma-hide-disputes"
          checked={hideDisputes}
          onCheckedChange={(on) => {
            setHideDisputes(on);
            if (on) setShown(false);
            setLine(on ? "on" : "off");
          }}
        />
      </label>

      {why && (
        <UmaExplainer
          kind={why}
          noun="post"
          open
          onOpenChange={(open) => {
            if (!open) setWhy(null);
          }}
          onReveal={() => (why === "dispute" ? showDispute() : viewSevere())}
        />
      )}
    </div>
  );
}
