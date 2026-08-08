import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@umamin/ui/components/label";
import { cn } from "@umamin/ui/lib/utils";
import { BanIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { PRO_THEME_STYLES } from "@/components/pro-flair";
import { Link } from "@/lib/navigation";
import { hasUmaminPro, PRO_THEMES, type ProTheme } from "@/lib/pro";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser, patchUserProfile } from "@/lib/query-cache";
import type {
  CurrentUserResponse,
  UserProfileResponse,
  UserWithAccount,
} from "@/lib/types";
import { updateProfileThemeAction } from "./actions";

// Pro cosmetic: the profile theme picker. The stored preference survives a
// Pro lapse (the profile just stops rendering it — activeProTheme), so a
// lapsed Pro sees a locked card, not a destroyed setting.
export function ProThemeSection({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const isPro = hasUmaminPro(user.proUntil);
  const current = (user.profileTheme ?? null) as ProTheme | null;

  const mutation = useMutation({
    mutationFn: async (theme: ProTheme | null) => {
      const res = await updateProfileThemeAction({ theme });
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.theme;
    },
    onSuccess: (theme) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (cached) =>
          patchCurrentUser(cached, (currentUser) => ({
            ...currentUser,
            profileTheme: theme,
          })),
      );
      queryClient.setQueryData<UserProfileResponse>(
        queryKeys.userProfile(user.username),
        (cached) =>
          patchUserProfile(cached, (profile) => ({
            ...profile,
            profileTheme: theme,
          })),
      );
      toast.success(theme ? "Theme updated." : "Theme removed.");
    },
    onError: (error) => {
      toast.error(error.message ?? "Couldn't update the theme.");
    },
  });

  if (!isPro) {
    return (
      <section>
        <Label>Profile Theme</Label>
        <div className="mt-2 rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">An Umamin Pro perk</p>
          <p className="mt-1 text-muted-foreground">
            Pick a color theme for your profile and message pages.{" "}
            {user.profileTheme
              ? "Your saved theme comes back when Pro is active. "
              : ""}
            <Link href="/tiers" className="underline hover:text-foreground">
              Get Pro
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Label>Profile Theme</Label>
      <div className="mt-2 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label="No theme"
            aria-pressed={current === null}
            disabled={mutation.isPending}
            onClick={() => current !== null && mutation.mutate(null)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border bg-muted text-muted-foreground",
              current === null &&
                "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
          >
            <BanIcon className="size-4" />
          </button>

          {/* Each swatch carries its theme class + bg-primary, so it renders
              the EXACT color the profile will use in the current color mode —
              one source of truth, no duplicated swatch palette. */}
          {PRO_THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              aria-label={`${PRO_THEME_STYLES[theme].label} theme`}
              aria-pressed={current === theme}
              disabled={mutation.isPending}
              onClick={() => current !== theme && mutation.mutate(theme)}
              className={cn(
                "flex size-9 items-center justify-center rounded-full bg-primary",
                PRO_THEME_STYLES[theme].className,
                current === theme &&
                  "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
            >
              {current === theme && (
                <CheckIcon className="size-4 text-primary-foreground" />
              )}
            </button>
          ))}
        </div>
        <p className="mt-3 text-muted-foreground text-sm">
          Colors your profile page and your anonymous-message page. Shown while
          your Pro is active.
        </p>
      </div>
    </section>
  );
}
