"use client";

import { z } from "zod";
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
    password: z.string().min(5, {
      message: "Password must be at least 5 characters.",
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
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values);
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
                You can only change username with Google OAuth.
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

        <Button type="submit" className="w-full">
          Create an account
        </Button>
      </form>
    </Form>
  );
}
