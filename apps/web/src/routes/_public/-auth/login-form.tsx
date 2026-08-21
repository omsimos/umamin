import { useMutation } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";
import {
  TURNSTILE_ENABLED,
  Turnstile,
  type TurnstileHandle,
} from "@/components/turnstile";
import { callAction } from "@/lib/api";

type LoginResult = { redirect?: string; error?: string };

// Reworked from apps/www's useActionState form to useMutation + callAction:
// the Hono `loginHandler` returns { redirect } on success (a full navigation so
// the freshly-set session cookie is picked up on the next load) or { error }.
// Field error is announced to assistive tech via role="alert" (a11y parity).
export function LoginForm() {
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: (form: {
      username: string;
      password: string;
      turnstileToken: string;
    }) => callAction<LoginResult>("login", form) as Promise<LoginResult>,
    onSuccess: (res) => {
      if (res.redirect) {
        window.location.href = res.redirect;
        return;
      }
      setError(res.error ?? "Incorrect username or password");
      // The form stays on screen after a failure, and a Turnstile token is
      // single-use — without this the retry fails as already-spent.
      turnstile.current?.reset();
    },
    onError: () => {
      setError("An unexpected error occurred");
      turnstile.current?.reset();
    },
  });

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError("");
        mutate({
          username: String(data.get("username") ?? ""),
          password: String(data.get("password") ?? ""),
          turnstileToken: token,
        });
      }}
    >
      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          required
          id="username"
          name="username"
          placeholder="umamin"
          autoComplete="username"
          className="mt-2"
          onChange={(e) => {
            e.currentTarget.value = e.currentTarget.value.toLowerCase();
          }}
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          required
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-2"
        />
        {error && (
          <p role="alert" className="text-red-500 text-sm mt-2 font-medium">
            {error}
          </p>
        )}
      </div>

      <Turnstile ref={turnstile} action="login" onToken={setToken} />

      <div>
        <Button
          disabled={isPending || (TURNSTILE_ENABLED && !token)}
          type="submit"
          className="w-full"
        >
          {isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
          Login
        </Button>

        <Button disabled={isPending} variant="outline" asChild>
          {/* Full navigation to the Worker OAuth initiator (not a router route). */}
          <a href="/auth/google?intent=login" className="mt-4 w-full">
            Continue with Google
          </a>
        </Button>
      </div>
    </form>
  );
}
