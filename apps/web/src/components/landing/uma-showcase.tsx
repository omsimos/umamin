import { Button } from "@umamin/ui/components/button";
import { Switch } from "@umamin/ui/components/switch";
import { blobatarUri } from "blobatar/uri";
import { useState } from "react";
import { Uma } from "@/components/uma";
import { type CoverKind, UmaExplainer } from "@/components/uma-explainer";

function Author({ user }: { user: string }) {
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
      <span className="text-muted-foreground">3h</span>
    </div>
  );
}

/**
 * A two-post feed that behaves like the real covers: the dispute folds while
 * Hide disputes is on, the severe post stays covered, and Why? opens the same
 * explainer the app uses.
 */
export function UmaShowcase() {
  const [hideDisputes, setHideDisputes] = useState(true);
  const [shown, setShown] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [why, setWhy] = useState<CoverKind | null>(null);

  return (
    <div className="rounded-3xl border bg-card p-4 shadow-xl sm:p-5">
      <label
        htmlFor="uma-hide-disputes"
        className="flex items-center justify-between gap-4 rounded-2xl bg-muted/60 px-4 py-3"
      >
        <span className="text-sm">
          <span className="block font-medium">Hide disputes</span>
          <span className="text-muted-foreground">Try turning it off</span>
        </span>
        <Switch
          id="uma-hide-disputes"
          checked={hideDisputes}
          onCheckedChange={setHideDisputes}
        />
      </label>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <article className="rounded-2xl border bg-background/60 p-4">
          <Author user="lowkey.mad" />
          {hideDisputes && !shown ? (
            <div className="mt-2 flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <Uma className="size-5" />
              <p className="flex-1 truncate">Folded: possible dispute</p>
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
                onClick={() => setShown(true)}
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
          <Author user="anon_1427" />
          {viewed ? (
            <p className="mt-3 animate-reveal-pop text-sm text-muted-foreground italic">
              On Umamin, this is where the post would show. It's left out of
              this demo.
            </p>
          ) : (
            <div className="relative mt-2 min-h-36">
              <p aria-hidden className="select-none pt-1 text-sm blur-md">
                This text is blurred. It stands in for a post that may contain
                slurs, threats or someone's private details, and the same cover
                shows for every viewer.
              </p>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <Uma mood="serious" className="size-9" />
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
                    onClick={() => setViewed(true)}
                  >
                    View
                  </Button>
                </div>
              </div>
            </div>
          )}
        </article>
      </div>

      {why && (
        <UmaExplainer
          kind={why}
          noun="post"
          open
          onOpenChange={(open) => {
            if (!open) setWhy(null);
          }}
          onReveal={() =>
            why === "dispute" ? setShown(true) : setViewed(true)
          }
        />
      )}
    </div>
  );
}
