import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import {
  BanIcon,
  BarChart3Icon,
  GemIcon,
  HeartIcon,
  ImagePlusIcon,
  Loader2Icon,
  type LucideIcon,
  MailIcon,
  MessagesSquareIcon,
  PaletteIcon,
  RocketIcon,
  ScrollTextIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { callAction } from "@/lib/api";
import { MIN_AURA_FOR_IMAGES } from "@/lib/post-images";
import {
  hasUmaminPro,
  PRO_PER_MONTH_PHP,
  PRO_PRICE_PHP,
  PRO_TERM_MONTHS,
} from "@/lib/pro";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { getActionError, hasUmaminPlus } from "@/lib/utils";

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

const PRO_PERKS: Perk[] = [
  {
    icon: BanIcon,
    title: "Ad-free",
    detail: "Browse Umamin without any ads.",
  },
  {
    icon: GemIcon,
    title: "Pro badge",
    detail: "A Pro badge on your profile, in your theme's color.",
  },
  {
    icon: PaletteIcon,
    title: "Profile themes",
    detail: "Color your profile and anonymous-message pages.",
  },
  {
    icon: RocketIcon,
    title: "Everything in Plus",
    detail: "Polls and group creation, whatever your account age.",
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

const routeApi = getRouteApi("/_public/tiers");

export function TiersView() {
  const { pro } = routeApi.useSearch();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const user = data?.user;
  const isPlus = hasUmaminPlus(user?.createdAt);
  const isPro = hasUmaminPro(user?.proUntil);

  // The webhook grants Pro moments after Lemon Squeezy redirects back here —
  // refetch so the Active badge appears without a manual reload.
  useEffect(() => {
    if (pro === "success") {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
    }
  }, [pro, queryClient]);

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await callAction<{ url: string }>("createProCheckoutAction");
      if (res && "url" in res) return res.url;
      throw new Error(getActionError(res) ?? "An error occurred");
    },
    onSuccess: (url) => {
      window.location.assign(url);
    },
    onError: (err) => toast.error(err.message),
  });
  // Stay disabled through the redirect — the mutation "succeeds" before the
  // browser actually leaves, and a re-click would mint a second checkout.
  const checkingOut = checkout.isPending || checkout.isSuccess;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Umamin Tiers</h1>
        <p className="text-sm text-muted-foreground">
          More ways to express yourself, anonymously.
        </p>
      </header>

      <Tabs
        defaultValue={
          pro === "success" || isPro ? "pro" : isPlus ? "plus" : "free"
        }
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="free">Free</TabsTrigger>
          <TabsTrigger value="plus">Plus</TabsTrigger>
          <TabsTrigger value="pro">Pro</TabsTrigger>
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

        <TabsContent value="pro" className="mt-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Everything in Plus, plus:
            </p>
            <Badge variant={isPro ? "default" : "secondary"}>
              {isPro ? "Active" : "One-time purchase"}
            </Badge>
          </div>
          <PerkList perks={PRO_PERKS} />

          {pro === "success" && !isPro && (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              Payment received — Pro unlocks as soon as the order is confirmed,
              usually within a minute. Check back shortly.
            </div>
          )}

          <div className="space-y-3 rounded-xl border p-4">
            <div>
              <p className="text-xl font-semibold">
                ₱{PRO_PRICE_PHP}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  for {PRO_TERM_MONTHS} months
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                That's around ₱{PRO_PER_MONTH_PHP} a month. One-time payment —
                not a subscription, nothing to cancel.
              </p>
            </div>

            {user || isPending ? (
              <Button
                className="w-full"
                disabled={checkingOut || isPending}
                onClick={() => checkout.mutate()}
              >
                {checkingOut && <Loader2Icon className="animate-spin" />}
                {isPro
                  ? `Add ${PRO_TERM_MONTHS} more months — ₱${PRO_PRICE_PHP}`
                  : `Get Pro — ₱${PRO_PRICE_PHP}`}
              </Button>
            ) : (
              <Button className="w-full" asChild>
                <Link to="/login">Sign in to get Pro</Link>
              </Button>
            )}

            {isPro && user?.proUntil && (
              <p className="text-xs text-muted-foreground">
                Pro is active until{" "}
                {new Date(user.proUntil).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                . Buying again adds {PRO_TERM_MONTHS} months on top.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
