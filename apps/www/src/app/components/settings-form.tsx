"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@umamin/ui/components/button";
import { Switch } from "@umamin/ui/components/switch";
import { Check, MessageCircleOff } from "lucide-react";
import { Textarea } from "@umamin/ui/components/textarea";
import { Input } from "@umamin/ui/components/input";

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

const FormSchema = z.object({
  bio: z
    .string()
    .min(10, {
      message: "Bio must be at least 10 characters.",
    })
    .max(160, {
      message: "Bio must not be longer than 30 characters.",
    }),
  username: z.string().min(3, {
    message: "Username must be at least 3 characters.",
  }),
  pause_link: z.boolean(),
});

export function SettingsForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      /**
       * !! Match value in DB !!
       */
      pause_link: false,
    },
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
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='pause_link'
          render={({ field }) => (
            <FormItem>
              <div className=' flex items-center space-x-4 rounded-md border p-4'>
                <MessageCircleOff />
                <div className='flex-1 space-y-1'>
                  <p className='text-sm font-medium leading-none'>Pause Link</p>
                  <p className='text-sm text-muted-foreground'>
                    Temporarily disable receiving anonymous messages.
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

        <Accordion type='single' collapsible>
          <AccordionItem value='item-1'>
            <AccordionTrigger className='text-sm'>
              Update Username
            </AccordionTrigger>
            <AccordionContent>
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        className='focus-visible:ring-transparent'
                        placeholder='omsimos'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This is your public display name.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value='item-2'>
            <AccordionTrigger className='text-sm'>Update Bio</AccordionTrigger>
            <AccordionContent>
              <FormField
                control={form.control}
                name='bio'
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder='Tell us a little bit about yourself'
                        className='focus-visible:ring-transparent resize-none'
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button type='submit' className='w-full'>
          <Check className='mr-2 h-4 w-4' />
          Update Profile
        </Button>
      </form>
    </Form>
  );
}
