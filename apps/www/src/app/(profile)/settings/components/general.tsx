"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { useForm } from "react-hook-form";
import { analytics } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { logEvent } from "firebase/analytics";
import { Info, Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";

import client from "@/lib/gql/client";
import { formatError } from "@/lib/utils";
import { Input } from "@umamin/ui/components/input";
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
import { CurrentUserResult } from "../queries";

const UPDATE_USER_MUTATION = graphql(`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input)
  }
`);

const updateUserPersisted = graphql.persisted(
  "0eb5223468cd7923b5d9a12fc2104425d047f9d34a871160b2e8d37bfc9224fc",
  UPDATE_USER_MUTATION
);

const FormSchema = z.object({
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
  displayName: z.string().max(20, {
    message: "Display name must not exceed 20 characters.",
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

export function GeneralSettings({ user }: { user: CurrentUserResult }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const account = user?.accounts?.length ? user.accounts[0] : null;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      bio: user?.bio ?? "",
      question: user?.question,
      username: user?.username,
      displayName: user?.displayName ?? "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (
      user?.username === data.username &&
      user?.bio === data.bio &&
      user?.question === data.question &&
      user?.displayName === data.displayName
    ) {
      toast.info("No changes detected");
      return;
    }

    setSaving(true);

    const res = await client.mutation(updateUserPersisted, {
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
    router.refresh();
    toast.success("Details updated");
    logEvent(analytics, "update_details");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input
                  disabled={saving}
                  className="focus-visible:ring-transparent"
                  placeholder="Umamin"
                  {...field}
                />
              </FormControl>
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
                  disabled={!account || saving}
                  className="focus-visible:ring-transparent"
                  placeholder="umamin"
                  {...field}
                />
              </FormControl>
              {account ? (
                <FormDescription>
                  Your previous username will be available to other users.
                </FormDescription>
              ) : (
                <FormDescription className="flex items-center text-yellow-500">
                  <Info className="w-4 h-4 mr-1" />
                  Google account required
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
                  disabled={saving}
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
                  disabled={saving}
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
          <Button disabled={saving} type="submit" className="w-full mt-2">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
