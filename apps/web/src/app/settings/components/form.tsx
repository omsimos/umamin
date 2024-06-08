"use client";

import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { useForm } from "react-hook-form";
import { analytics } from "@/lib/firebase";
import { CircleX, Info, Loader2, TriangleAlert } from "lucide-react";
import { logEvent } from "firebase/analytics";
import { MessageCircleOff } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";

import { getClient } from "@/lib/gql";
import { formatError } from "@/lib/utils";
import { Input } from "@umamin/ui/components/input";
import { Switch } from "@umamin/ui/components/switch";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@umamin/ui/components/form";
import { UserByIdResult } from "../queries";

const UpdateUserMutation = graphql(`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      __typename
      id
      bio
      username
      imageUrl
      createdAt
    }
  }
`);

const FormSchema = z.object({
  quietMode: z.boolean(),
  question: z
    .string()
    .min(1, {
      message: "Custom message must be at least 1 character.",
    })
    .max(150, {
      message: "Custom message must not be longer than 150 characters.",
    }),
  bio: z.string().max(150, {
    message: "Bio must not be longer than 150 characters.",
  }),
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
});

export function SettingsForm({ user }: { user: UserByIdResult }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const profile = user?.profile?.length ? user.profile[0] : null;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      quietMode: user?.quietMode,
      bio: user?.bio ?? "",
      question: user?.question,
      username: user?.username,
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (
      user?.username === data.username &&
      user?.bio === data.bio &&
      user?.question === data.question &&
      user?.quietMode === data.quietMode
    ) {
      toast.info("No changes detected.");
      return;
    }

    setSaving(true);

    const res = await getClient().mutation(UpdateUserMutation, {
      input: {
        ...data,
        username: data.username.toLowerCase(),
      },
    });

    if (res.error) {
      setSaving(false);
      toast.error(formatError(res.error.message));
      return;
    }

    setSaving(false);
    toast.success("Details updated");
    logEvent(analytics, "update_details");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="quietMode"
          render={({ field }) => (
            <FormItem>
              <div className=" flex items-center space-x-4 rounded-md border p-4">
                <MessageCircleOff />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">Quiet Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Temporarily disable incoming messages.
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  disabled={!profile}
                  className="focus-visible:ring-transparent"
                  placeholder="omsimos"
                  {...field}
                  value={field.value as string}
                />
              </FormControl>
              {profile ? (
                <FormDescription className="flex items-center">
                  <TriangleAlert className="w-4 h-4 mr-1" />
                  Your previous username will be available to others.
                </FormDescription>
              ) : (
                <FormDescription className="flex items-center text-yellow-500">
                  <Info className="w-4 h-4 mr-1" />
                  Google account required.
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custom Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Send me an anonymous message!"
                  className="focus-visible:ring-transparent resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us a little bit about yourself"
                  className="focus-visible:ring-transparent resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          {!profile && (
            <>
              {searchParams.get("error") === "used" && (
                <div className="flex items-center text-red-500 text-sm mb-2">
                  <CircleX className="h-4 w-4 mr-1" />
                  Account already linked to a different profile.
                </div>
              )}
              <Button variant="outline" asChild>
                <Link href="/login/google" className="w-full">
                  Connect Google Account
                </Link>
              </Button>
            </>
          )}

          <Button disabled={saving} type="submit" className="w-full mt-2">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
