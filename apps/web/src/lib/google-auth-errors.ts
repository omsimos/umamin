// Codes the Google callback puts in ?error= on /login and /settings.
export const GOOGLE_AUTH_ERRORS = {
  cancelled: {
    title: "Google sign-in cancelled",
    description: "Nothing changed. You can try again when you're ready.",
  },
  expired: {
    title: "Google sign-in expired",
    description:
      "That sign-in took too long or was already used. Please try again.",
  },
  failed: {
    title: "Google sign-in failed",
    description:
      "Something went wrong while signing you in with Google. Please try again.",
  },
  rate_limited: {
    title: "Too many requests",
    description: "Please try again in a minute.",
  },
  blocked: {
    title: "Access blocked",
    description: "Your access has been blocked.",
  },
  no_account: {
    title: "No account found",
    description: "That Google account isn't linked to an Umamin account.",
  },
  already_linked: {
    title: "Failed to link account",
    description: "Google account already connected to a different profile.",
  },
  has_google: {
    title: "Google account already connected",
    description:
      "This profile already has a Google account. Disconnect it in Settings before connecting another.",
  },
} as const;

export type GoogleAuthErrorCode = keyof typeof GOOGLE_AUTH_ERRORS;

// ?error= is attacker-controlled text. Object.hasOwn keeps inherited keys
// such as "constructor" from resolving to something renderable.
export function googleAuthError(code: string | undefined) {
  return code !== undefined && Object.hasOwn(GOOGLE_AUTH_ERRORS, code)
    ? GOOGLE_AUTH_ERRORS[code as GoogleAuthErrorCode]
    : null;
}
