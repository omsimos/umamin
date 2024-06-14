"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { analytics } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";
import { Loader2, CircleX } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@umamin/ui/components/form";
import { updatePassword } from "@/actions";

const FormSchema = z
  .object({
    currentPassword: z.string().max(255, { message: "Invalid password" }),
    password: z
      .string()
      .min(5, {
        message: "Password must be at least 5 characters",
      })
      .max(255, {
        message: "Password must not exceed 255 characters",
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

export function AccountForm({ pwdHash }: { pwdHash?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setSaving(true);

    const res = await updatePassword({
      currentPassword: data.currentPassword,
      password: data.password,
    });

    if (res?.error) {
      toast.error(res.error);
      setSaving(false);
      return;
    }

    setSaving(false);

    toast.success("Password updated successfully");
    form.reset();
    router.refresh();
    logEvent(analytics, "update_password");
  }

  return (
    <>
      {searchParams.get("error") === "already_linked" && (
        <div className="flex items-center text-red-500 text-sm mt-2">
          <CircleX className="h-4 w-4 mr-1" />
          Account already linked to a different profile.
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-8">
          {pwdHash && (
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Verify your password"
                      disabled={saving}
                      className="focus-visible:ring-transparent"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Create a new strong password"
                    disabled={saving}
                    className="focus-visible:ring-transparent"
                    {...field}
                  />
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
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    disabled={saving}
                    className="focus-visible:ring-transparent"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Button
              disabled={
                saving ||
                (!!pwdHash && !form.getValues("currentPassword")) ||
                !form.getValues("password") ||
                !form.getValues("confirmPassword")
              }
              type="submit"
              className="w-full mt-2"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pwdHash ? "Change" : "Add"} Password
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
