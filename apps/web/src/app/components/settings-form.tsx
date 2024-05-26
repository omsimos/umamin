"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { analytics } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { logEvent } from "firebase/analytics";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageCircleOff } from "lucide-react";
import { type ControllerRenderProps, useForm } from "react-hook-form";

import { getClient } from "@/lib/gql";
import { formatError } from "@/lib/utils";
import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@umamin/ui/components/form";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@umamin/ui/components/accordion";
import { SelectUser } from "@umamin/server/db/schema";

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

export function SettingsForm({ user }: { user: SelectUser }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      quietMode: user.quietMode,
      bio: user.bio ?? "",
      question: user.question,
      username: user.username,
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
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

  type settingsData = {
    title: string;
    name: "quietMode" | "question" | "bio" | "username";
    content: (
      field: ControllerRenderProps<z.infer<typeof FormSchema>>,
    ) => JSX.Element;
    description: string;
  };

  const settingsData: settingsData[] = [
    {
      title: "Update Custom Message",
      name: "question",
      content: (field) => (
        <Textarea
          placeholder="Send me an anonymous message!"
          className="focus-visible:ring-transparent resize-none"
          {...field}
          value={field.value as string}
        />
      ),
      description: "This will update your anonymous message.",
    },
    {
      title: "Update Username",
      name: "username",
      content: (field) => (
        <Input
          className="focus-visible:ring-transparent"
          placeholder="omsimos"
          {...field}
          value={field.value as string}
        />
      ),
      description: "This is your public display name.",
    },
    {
      title: "Update Bio",
      name: "bio",
      content: (field) => (
        <Textarea
          placeholder="Tell us a little bit about yourself"
          className="focus-visible:ring-transparent resize-none"
          {...field}
          value={field.value as string}
        />
      ),
      description: "This will be publicly displayed in your profile.",
    },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

        <Accordion type="single" collapsible>
          {settingsData.map((data) => {
            const { title, name, content, description } = data;

            return (
              <AccordionItem key={data.name} value={name}>
                <AccordionTrigger className="text-sm">{title}</AccordionTrigger>
                <AccordionContent>
                  <FormField
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>{content(field)}</FormControl>
                        <FormDescription>{description}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <Button disabled={saving} type="submit" className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}
