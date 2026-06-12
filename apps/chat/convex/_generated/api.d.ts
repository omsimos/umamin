/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as cleanup from "../cleanup.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as decks from "../decks.js";
import type * as games from "../games.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_sessions from "../lib/sessions.js";
import type * as match from "../match.js";
import type * as presence from "../presence.js";
import type * as reveal from "../reveal.js";
import type * as vibe from "../vibe.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  cleanup: typeof cleanup;
  constants: typeof constants;
  crons: typeof crons;
  decks: typeof decks;
  games: typeof games;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/sessions": typeof lib_sessions;
  match: typeof match;
  presence: typeof presence;
  reveal: typeof reveal;
  vibe: typeof vibe;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
