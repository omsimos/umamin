"use client";

import { z } from "zod";
import { ThumbsUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { Input } from "@umamin/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@umamin/ui/components/button";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@umamin/ui/components/form";
import { signup } from "@/actions";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const formSchema = z
  .object({
    username: z
      .string()
      .min(5, {
        message: "Username must be at least 5 characters.",
      })
      .max(20, {
        message: "Username must not exceed 20 characters.",
      })
      .refine((url) => /^[a-zA-Z0-9_-]+$/.test(url), {
        message: "Username must be alphanumeric with no spaces.",
      }),
    password: z
      .string()
      .min(5, {
        message: "Password must be at least 5 characters.",
      })
      .max(255, {
        message: "Password must not exceed 255 characters.",
      }),
    confirmPassword: z.string(),
  })
  .refine(
    (values) => {
      return values.password === values.confirmPassword;
    },
    {
      message: "Password does not match",
      path: ["confirmPassword"],
    },
  );

export function RegisterForm() {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);

    const res = await signup({
      username: values.username.toLowerCase(),
      password: values.password,
    });

    if (res && res.error) {
      toast.error(res.error);
      setLoading(false);
    }

    setLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="umamin" {...field} />
              </FormControl>
              <FormDescription>
                You can still change this later.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <Button disabled={loading} type="submit" className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create an account
          </Button>

          <Button disabled={loading} variant="outline" asChild>
            <Link href="/login/google" className="mt-4 w-full">
              <ThumbsUp className="mr-2 h-4 w-4" />
              Continue with Google
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
