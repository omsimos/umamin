/**
 * A failure the app anticipates and already explains to the user — an action's
 * `{ error }` result, a failed validation, a declined permission. Throw it from
 * a mutationFn so the call site's toast shows the message while
 * captureException skips it: error tracking is for bugs, and these aren't.
 *
 * The server reports its own unexpected action failures, and callAction reports
 * transport failures, so re-throwing an action's `{ error }` as this loses
 * nothing.
 */
export class ExpectedError extends Error {
  override name = "ExpectedError";
}
