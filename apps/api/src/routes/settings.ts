import {
  deleteAccount,
  toggleDisplayPicture,
  toggleQuietMode,
  updateAvatar,
  updateGeneralSettings,
  updatePassword,
} from "@umamin/core";
import {
  deleteSessionTokenCookie,
  invalidateSession,
} from "@umamin/core/session";
import { Hono } from "hono";
import { jsonBody, requireSession } from "../context";
import { privateNoStore, resultJson } from "../http";
import { cookieWriter } from "../session";
import type { AppEnv } from "../types";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.patch("/api/settings/general", async (c) => {
  privateNoStore(c);
  return resultJson(
    c,
    await updateGeneralSettings(await requireSession(c), await jsonBody(c)),
  );
});

settingsRoutes.patch("/api/settings/password", async (c) => {
  privateNoStore(c);
  return resultJson(
    c,
    await updatePassword(await requireSession(c), await jsonBody(c)),
  );
});

settingsRoutes.patch("/api/settings/display-picture", async (c) => {
  privateNoStore(c);
  return resultJson(
    c,
    await toggleDisplayPicture(
      await requireSession(c),
      (await jsonBody(c)).accountImgUrl,
    ),
  );
});

settingsRoutes.patch("/api/settings/quiet-mode", async (c) => {
  privateNoStore(c);
  return resultJson(c, await toggleQuietMode(await requireSession(c)));
});

settingsRoutes.patch("/api/settings/avatar", async (c) => {
  privateNoStore(c);
  return resultJson(
    c,
    await updateAvatar(
      await requireSession(c),
      String((await jsonBody(c)).imageUrl ?? ""),
    ),
  );
});

settingsRoutes.delete("/api/account", async (c) => {
  privateNoStore(c);
  const result = await deleteAccount(await requireSession(c));
  await invalidateSession(result.sessionId);
  deleteSessionTokenCookie(cookieWriter(c));
  return c.json({ success: true });
});
