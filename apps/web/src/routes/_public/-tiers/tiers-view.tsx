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
import { cn } from "@umamin/ui/lib/utils";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useProOffer } from "@/hooks/use-pro-offer";
import { callAction } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import { MIN_AURA_FOR_IMAGES } from "@/lib/post-images";
import {
  hasUmaminPro,
  isProPurchaseConfirmed,
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
import { assignLocation } from "@/lib/reload-page";
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
    icon: ImagePlusIcon,
    title: "Post images right away",
    detail: `No waiting for ${MIN_AURA_FOR_IMAGES} aura. Attach photos from day one.`,
  },
  {
    icon: RocketIcon,
    title: "Everything in Plus",
    detail: "Polls, group creation, and the avatar shine, at any account age.",
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

const CONFIRM_POLL_MS = 3_000;
const CONFIRM_TIMEOUT_MS = 2 * 60_000;

const CHECKOUT_BASELINE_KEY = "umamin-pro:checkoutBaseline";

// The Pro horizon seen before leaving for checkout, in ms (0 for no Pro).
// Null when nothing was saved or storage is blocked.
function readCheckoutBaseline(): number | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_BASELINE_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeCheckoutBaseline(proUntil?: Date | string | null) {
  try {
    const ms = proUntil ? new Date(proUntil).getTime() : 0;
    sessionStorage.setItem(
      CHECKOUT_BASELINE_KEY,
      String(Number.isFinite(ms) ? ms : 0),
    );
  } catch {
    // Storage blocked: the return falls back to "any active Pro counts".
  }
}

function clearCheckoutBaseline() {
  try {
    sessionStorage.removeItem(CHECKOUT_BASELINE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function TiersView() {
  const { pro } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const queryClient = useQueryClient();
  // Captured once so the marker can leave the URL (below) while this view
  // still remembers the user came back from checkout.
  const [returnedFromCheckout] = useState(pro === "success");
  const [confirmTimedOut, setConfirmTimedOut] = useState(false);
  // Read in an effect, not during render: /tiers is server-rendered and the
  // server has no sessionStorage.
  const [baseline, setBaseline] = useState<number | null | undefined>(
    undefined,
  );
  useEffect(() => {
    if (returnedFromCheckout) setBaseline(readCheckoutBaseline());
  }, [returnedFromCheckout]);
  const { data, isPending } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
    refetchInterval: (query) => {
      const polled = query.state.data?.user;
      return returnedFromCheckout &&
        !confirmTimedOut &&
        polled &&
        baseline !== undefined &&
        !isProPurchaseConfirmed(polled.proUntil, baseline)
        ? CONFIRM_POLL_MS
        : false;
    },
  });

  const user = data?.user;
  const isPlus = hasUmaminPlus(user?.createdAt);
  const isPro = hasUmaminPro(user?.proUntil);
  // Pro is built but not launched. The flag hides the OFFER only — a user who
  // already bought keeps the badge, theme and ad-free perks either way.
  const proLaunched = useProOffer();

  // Back from checkout but the webhook hasn't applied the order yet. For a
  // renewal the user already has Pro, so the wait ends only when the horizon
  // moves past the one saved before checkout. The buy button stays off
  // meanwhile, so a second purchase isn't one tap away.
  const purchaseConfirmed =
    baseline !== undefined && isProPurchaseConfirmed(user?.proUntil, baseline);
  const awaitingPro = returnedFromCheckout && !!user && !purchaseConfirmed;
  const confirmation = !awaitingPro
    ? "none"
    : confirmTimedOut
      ? "delayed"
      : "awaiting";

  // The webhook grants Pro moments after Lemon Squeezy redirects back here —
  // refetch so the Active badge appears without a manual reload.
  useEffect(() => {
    if (returnedFromCheckout) {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
    }
  }, [returnedFromCheckout, queryClient]);

  // Drop ?pro=success once the wait is over (confirmed, timed out, or never
  // applied). Left in the URL, a reload or a later visit from history would
  // lock the buy button again for a user with no order in flight.
  const settled = !isPending && confirmation !== "awaiting";
  useEffect(() => {
    if (pro === "success" && settled) {
      navigate({ search: {}, replace: true });
    }
  }, [pro, settled, navigate]);

  useEffect(() => {
    if (confirmation !== "awaiting") return;
    const timer = setTimeout(
      () => setConfirmTimedOut(true),
      CONFIRM_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [confirmation]);

  useEffect(() => {
    if (returnedFromCheckout && purchaseConfirmed) clearCheckoutBaseline();
  }, [returnedFromCheckout, purchaseConfirmed]);

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await callAction<{ url: string }>("createProCheckoutAction");
      if (res && "url" in res) return res.url;
      throw new ExpectedError(getActionError(res) ?? "An error occurred");
    },
    onSuccess: (url) => {
      writeCheckoutBaseline(user?.proUntil);
      assignLocation(url);
    },
    onError: (err) => toast.error(err.message),
  });
  // The mutation stays "success" so the button is off through the redirect.
  // A page restored from the back-forward cache keeps that state, which would
  // leave the button stuck after the user pressed Back on the payment page.
  const resetCheckout = checkout.reset;
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resetCheckout();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [resetCheckout]);
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
          proLaunched && (returnedFromCheckout || isPro)
            ? "pro"
            : isPlus
              ? "plus"
              : "free"
        }
        className="space-y-4"
      >
        <TabsList
          className={cn(
            "grid w-full",
            proLaunched ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          <TabsTrigger value="free">Free</TabsTrigger>
          <TabsTrigger value="plus">Plus</TabsTrigger>
          {proLaunched && <TabsTrigger value="pro">Pro</TabsTrigger>}
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
            Plus is always free. Early access to new features once your account
            is a year old.
          </p>
        </TabsContent>

        {proLaunched && (
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

            {confirmation === "awaiting" && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm"
              >
                <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin" />
                <p>
                  Payment received. Pro unlocks as soon as the order is
                  confirmed, usually within a minute. This page updates on its
                  own.
                </p>
              </div>
            )}

            {confirmation === "delayed" && (
              <div
                role="status"
                className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm"
              >
                <p>
                  Your order is taking longer than usual to confirm. Please
                  don't pay again. Check again in a few minutes, and if Pro
                  still isn't active, email umamin@omsimos.com with your
                  receipt.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConfirmTimedOut(false);
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.currentUser(),
                    });
                  }}
                >
                  Check again
                </Button>
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
                  That's around ₱{PRO_PER_MONTH_PHP} a month. It's a one-time
                  payment, not a subscription, so there's nothing to cancel.
                </p>
              </div>

              {user || isPending ? (
                <Button
                  className="w-full"
                  disabled={checkingOut || isPending || awaitingPro}
                  onClick={() => checkout.mutate()}
                >
                  {checkingOut && <Loader2Icon className="animate-spin" />}
                  {isPro
                    ? `Add ${PRO_TERM_MONTHS} more months: ₱${PRO_PRICE_PHP}`
                    : `Get Pro: ₱${PRO_PRICE_PHP}`}
                </Button>
              ) : (
                <Button className="w-full" asChild>
                  <Link to="/login">Sign in to get Pro</Link>
                </Button>
              )}

              {isPro && user?.proUntil && (
                <p className="text-xs text-muted-foreground">
                  Pro is active until{" "}
                  {new Date(user.proUntil).toLocaleDateString("en-US", {
                    timeZone: "Asia/Manila",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  . Buying again adds {PRO_TERM_MONTHS} months on top.
                </p>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
