"use client";

import { Badge } from "@umamin/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { cn } from "@umamin/ui/lib/utils";
import {
  BarChart3Icon,
  CircleFadingPlusIcon,
  ImagePlusIcon,
  type LucideIcon,
  MailIcon,
  MessagesSquareIcon,
  RocketIcon,
  ScrollTextIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";

type Perk = { icon: LucideIcon; title: string; detail: string };

const FREE_PERKS: Perk[] = [
  {
    icon: MailIcon,
    title: "Anonymous inbox",
    detail: "Receive end-to-end encrypted anonymous messages.",
  },
  {
    icon: MessagesSquareIcon,
    title: "Feed & replies",
    detail: "Post, react, repost, and reply across the feed.",
  },
  {
    icon: ScrollTextIcon,
    title: "Notes",
    detail: "Share a fleeting note that strangers can react to.",
  },
  {
    icon: UsersRoundIcon,
    title: "Join groups",
    detail: "Join groups you're invited to and wear their tag.",
  },
];

const PLUS_PERKS: Perk[] = [
  {
    icon: UsersRoundIcon,
    title: "Create groups",
    detail: "Start your own group with a unique tag and icon.",
  },
  {
    icon: ImagePlusIcon,
    title: "Post images",
    detail: "Attach images to your posts.",
  },
  {
    icon: BarChart3Icon,
    title: "Polls",
    detail: "Add a poll to a post and gather opinions.",
  },
  {
    icon: SparklesIcon,
    title: "Avatar shine",
    detail: "A subtle shimmer marks your avatar as Plus.",
  },
];

const PRO_PERKS: Perk[] = [
  {
    icon: RocketIcon,
    title: "Everything in Plus",
    detail: "Plus more power tools as they land.",
  },
];

function PerkList({ perks }: { perks: Perk[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-muted/30">
      {perks.map(({ icon: Icon, title, detail }) => (
        <li key={title} className="flex items-start gap-3 p-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-medium leading-tight">{title}</p>
            <p className="text-sm text-muted-foreground">{detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Informational tier sheet (no purchase flow yet — Plus is account-age based).
// Free / Plus / Pro(coming soon), opened from the account drawer.
export function PlusDialog({
  open,
  onOpenChange,
  isPlus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPlus: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="items-center gap-1 border-b p-6 text-center">
          <CircleFadingPlusIcon className="size-9 text-pink-500" />
          <DialogTitle className="text-xl">Umamin Plus</DialogTitle>
          <DialogDescription>
            More ways to express yourself, anonymously.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue={isPlus ? "plus" : "free"}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-6 mt-4 grid grid-cols-3">
            <TabsTrigger value="free">Free</TabsTrigger>
            <TabsTrigger value="plus">Plus</TabsTrigger>
            <TabsTrigger value="pro">Pro</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6 pt-4">
            <TabsContent value="free" className="mt-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                Everything you get on Umamin, free for everyone.
              </p>
              <PerkList perks={FREE_PERKS} />
            </TabsContent>

            <TabsContent value="plus" className="mt-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Everything in Free, plus:
                </p>
                <Badge variant={isPlus ? "default" : "secondary"}>
                  {isPlus ? "Active" : "Unlocks at 1 year"}
                </Badge>
              </div>
              <PerkList perks={PLUS_PERKS} />
              <p className="text-xs text-muted-foreground">
                {isPlus
                  ? "You're on Umamin Plus — enjoy the perks."
                  : "Umamin Plus unlocks once your account is a year old."}
              </p>
            </TabsContent>

            <TabsContent value="pro" className="mt-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  The next tier, in the works.
                </p>
                <Badge variant="outline">Coming soon</Badge>
              </div>
              <div className={cn("opacity-70")}>
                <PerkList perks={PRO_PERKS} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
