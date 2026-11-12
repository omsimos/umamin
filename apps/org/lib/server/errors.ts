import "server-only";

// Canonical user-facing error strings. Single source so call sites can't drift.
export const GENERIC_ERROR = "An error occurred";
export const INVALID_INPUT_ERROR = "Invalid input";
export const INTERNAL_SERVER_ERROR = "Internal server error";
export const PASSWORD_CHANGE_REQUIRED_ERROR =
  "Set a new password before you continue.";
