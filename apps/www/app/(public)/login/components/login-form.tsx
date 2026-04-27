"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEventHandler, useState } from "react";
import { apiClientErrorMessage } from "@/lib/api-client";
import { googleAuthUrl, login } from "@/lib/api-mutations";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      router.push("/inbox");
      router.refresh();
    },
    onError: (error) => {
      setError(apiClientErrorMessage(error, "An unexpected error occurred"));
    },
  });

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    mutation.mutate({
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          required
          id="username"
          name="username"
          placeholder="umamin"
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
          className="mt-2"
        />
        {error && (
          <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>
        )}
      </div>

      <div>
        <Button disabled={mutation.isPending} type="submit" className="w-full">
          {mutation.isPending && (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          )}
          Login
        </Button>

        <Button disabled={mutation.isPending} variant="outline" asChild>
          <Link prefetch={false} href={googleAuthUrl()} className="mt-4 w-full">
            Continue with Google
          </Link>
        </Button>
      </div>
    </form>
  );
}
