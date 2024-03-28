"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { Textarea } from "@umamin/ui/components/textarea";
import { toast } from "sonner";
import { Check } from "lucide-react";

const FormSchema = z.object({
  bio: z
    .string()
    .min(10, {
      message: "Bio must be at least 10 characters.",
    })
    .max(160, {
      message: "Bio must not be longer than 30 characters.",
    }),
});

export function BioUpdateForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast("You submitted the following values:", {
      description: (
        <pre className='mt-2 w-[340px] rounded-md bg-slate-950 p-4'>
          <code className='text-white'>{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className=' space-y-6'>
        <FormField
          control={form.control}
          name='bio'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Tell us a little bit about yourself'
                  className='resize-none'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                This will be publicly displayed in your profile.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' className='w-full'>
          <Check className='mr-2 h-4 w-4' />
          Update Profile
        </Button>
      </form>
    </Form>
  );
}
