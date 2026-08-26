import { useMutation } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { callAction } from "@/lib/api";
import { registerSchema } from "@/lib/schema";

type SignupResult = { redirect?: string; error?: string };
type Values = { username: string; password: string; confirmPassword: string };
type FieldErrors = Partial<Record<keyof Values, string>>;

// Reworked from apps/www's useAppForm (@tanstack/react-form) to plain fields +
// useMutation + callAction. Client-side zod validation (registerSchema, the
// same schema the Hono `signupHandler` re-validates) keeps field-level errors;
// each is announced to assistive tech (role="alert"). Server returns
// { redirect } on success (full navigation → session cookie applied) or
// { error }.
export function RegisterForm() {
  const [errors, setErrors] = useState<FieldErrors>({});

  const { mutate, isPending } = useMutation({
    mutationFn: (form: Values) =>
      callAction<SignupResult>("signup", form) as Promise<SignupResult>,
    onSuccess: (res) => {
      if (res.redirect) {
        toast.success("Account created.");
        window.location.href = res.redirect;
        return;
      }
      toast.error(res.error ?? "Couldn't create account.");
    },
    onError: () => {
      toast.error("Couldn't create account.");
    },
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const values: Values = {
          username: String(data.get("username") ?? "")
            .trim()
            .toLowerCase(),
          password: String(data.get("password") ?? ""),
          confirmPassword: String(data.get("confirmPassword") ?? ""),
        };

        const parsed = registerSchema.safeParse(values);
        if (!parsed.success) {
          const next: FieldErrors = {};
          for (const issue of parsed.error.issues) {
            const key = issue.path[0] as keyof Values | undefined;
            if (key && !next[key]) next[key] = issue.message;
          }
          setErrors(next);
          return;
        }

        setErrors({});
        mutate(values);
      }}
    >
      <div>
        <div>
          <Label htmlFor="username" className="h-7">
            Username<span className="text-destructive">*</span>
          </Label>
          <Input
            required
            id="username"
            name="username"
            placeholder="umamin"
            autoComplete="username"
            onChange={(e) => {
              e.currentTarget.value = e.currentTarget.value.toLowerCase();
            }}
          />
          {errors.username && (
            <p role="alert" className="text-sm text-destructive">
              {errors.username}
            </p>
          )}
        </div>

        <p className="text-muted-foreground text-sm mt-2">
          You can still change this later
        </p>
      </div>

      <div>
        <Label htmlFor="password" className="h-7">
          Password<span className="text-destructive">*</span>
        </Label>
        <Input
          required
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        {errors.password && (
          <p role="alert" className="text-sm text-destructive">
            {errors.password}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword" className="h-7">
          Confirm Password<span className="text-destructive">*</span>
        </Label>
        <Input
          required
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
        />
        {errors.confirmPassword && (
          <p role="alert" className="text-sm text-destructive">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <Button disabled={isPending} type="submit" className="w-full">
          {isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
          Create an account
        </Button>

        <Button variant="outline" asChild>
          {/* Full navigation to the Worker OAuth initiator (not a router route). */}
          <a href="/auth/google?intent=register" className="w-full">
            Continue with Google
          </a>
        </Button>
      </div>
    </form>
  );
}
