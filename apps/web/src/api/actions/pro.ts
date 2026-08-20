import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { FLAG_UMAMIN_PRO } from "../../lib/flags";
import {
  hasUmaminPro,
  PRO_CHECKOUT_UNAVAILABLE_ERROR,
  PRO_REQUIRED_ERROR,
  PRO_THEMES,
} from "../../lib/pro";
import { action } from "../../server-lib/action";
import { isFlagEnabled } from "../../server-lib/flags";
import { createProCheckout } from "../../server-lib/lemonsqueezy";
import { ctxDb } from "./_shared";

// Mints a single-use Lemon Squeezy hosted checkout for Umamin Pro, tagged with
// the buyer's user id (custom data) so the order webhook can attribute the
// grant. Signed-in only — an anonymous checkout would have no account to grant
// Pro to. Already-Pro users may buy again; purchases stack (see lib/pro.ts).
export const createProCheckoutHandler = action(
  {
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `procheckout:${session.userId}`,
    },
  },
  async (_input, { user, c }) => {
    // Re-checked server-side, not just hidden in the UI: a stale tab or a direct
    // call must not be able to mint a checkout for an unlaunched product and
    // take someone's money.
    if (!(await isFlagEnabled(c.env, user.id, FLAG_UMAMIN_PRO))) {
      return { error: PRO_CHECKOUT_UNAVAILABLE_ERROR };
    }

    const url = await createProCheckout(c.env, user.id);
    if (!url) {
      return { error: PRO_CHECKOUT_UNAVAILABLE_ERROR };
    }
    return { url };
  },
);

const themeSchema = z.object({
  theme: z.enum(PRO_THEMES).nullable(),
});

// Equips a profile theme (Pro cosmetic). Setting one re-checks the Pro
// horizon server-side; CLEARING is always allowed — a lapsed Pro must be able
// to remove a stored preference. The render path re-checks entitlement anyway
// (activeProTheme), so this gate is about not accepting writes it would never
// show, not about trusting the client.
export const updateProfileThemeHandler = action(
  {
    schema: themeSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `protheme:${session.userId}`,
    },
  },
  async ({ theme }, { user, c }) => {
    if (theme && !hasUmaminPro(user.proUntil)) {
      return { error: PRO_REQUIRED_ERROR };
    }

    await ctxDb(c)
      .update(userTable)
      .set({ profileTheme: theme })
      .where(eq(userTable.id, user.id));

    return { success: true as const, theme };
  },
);
