"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@umamin/ui/components/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import {
  BanIcon,
  BarChart3Icon,
  HeartIcon,
  ImagePlusIcon,
  type LucideIcon,
  MailIcon,
  MessagesSquareIcon,
  RocketIcon,
  ScrollTextIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";
import { MIN_AURA_FOR_IMAGES } from "@/lib/post-images";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { hasUmaminPlus } from "@/lib/utils";

type Perk = { icon: LucideIcon; title: string; detail: string };

const FREE_PERKS: Perk[] = [
  {
    icon: MailIcon,
    title: "Anonymous inbox",
    detail: "Receive anonymous messages, encrypted at rest.",
  },
  {
    icon: MessagesSquareIcon,
    title: "Feed & replies",
    detail: "Post, react, repost, and reply across the feed.",
  },
  {
    icon: ImagePlusIcon,
    title: "Post images",
    detail: `Attach photos to any post once you reach ${MIN_AURA_FOR_IMAGES} aura.`,
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
    icon: BarChart3Icon,
    title: "Polls",
    detail: "Add a poll to a post and gather opinions.",
  },
  {
    icon: SparklesIcon,
    title: "Avatar shine",
    detail: "A subtle shimmer marks your avatar.",
  },
];

const PREMIUM_PERKS: Perk[] = [
  {
    icon: BanIcon,
    title: "Ad-free",
    detail: "Browse Umamin without any ads.",
  },
  {
    icon: RocketIcon,
    title: "Everything in Plus",
    detail: "All early-access features, included.",
  },
  {
    icon: HeartIcon,
    title: "Support Umamin",
    detail: "Keep an open-source, anonymous space running.",
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

export function TiersView() {
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const isPlus = hasUmaminPlus(data?.user?.createdAt);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Umamin Plus</h1>
        <p className="text-sm text-muted-foreground">
          More ways to express yourself, anonymously.
        </p>
      </header>

      <Tabs defaultValue={isPlus ? "plus" : "free"} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="free">Free</TabsTrigger>
          <TabsTrigger value="plus">Plus</TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
        </TabsList>

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
              {isPlus ? "Active" : "Free at 1 year"}
            </Badge>
          </div>
          <PerkList perks={PLUS_PERKS} />
          <p className="text-xs text-muted-foreground">
            Plus is always free — early access to new features once your account
            is a year old.
          </p>
        </TabsContent>

        <TabsContent value="premium" className="mt-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Everything in Plus, plus:
            </p>
            <Badge variant="outline">Coming soon</Badge>
          </div>
          <div className="opacity-70">
            <PerkList perks={PREMIUM_PERKS} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
