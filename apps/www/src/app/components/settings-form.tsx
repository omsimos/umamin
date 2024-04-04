"use client";

import { z } from "zod";
import { toast } from "sonner";
import {
  type ControllerRenderProps,
  useForm,
  type FieldValues,
} from "react-hook-form";
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
  pauseLink: z.boolean(),
  customMessage: z
    .string()
    .min(10, {
      message: "Custom message must be at least 10 characters.",
    })
    .max(160, {
      message: "Custom message must not be longer than 30 characters.",
    }),
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
});

export function SettingsForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      /**
       * !! Match value in DB !!
       */
      pauseLink: false,
      customMessage: "Send me an anonymous message!",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast("You submitted the following values:", {
      description: (
        <pre className='mt-2 w-[340px] rounded-md border-0 bg-slate-950 p-4'>
          <code className='text-white'>{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  type settingsData = {
    title: string;
    name: "pauseLink" | "customMessage" | "bio" | "username";
    content: (
      field: ControllerRenderProps<z.infer<typeof FormSchema>>
    ) => JSX.Element;
    description: string;
  };

  const settingsData: settingsData[] = [
    {
      title: "Update Custom Message",
      name: "customMessage",
      content: (field) => (
        <Textarea
          placeholder='Send me an anonymous message!'
          className='focus-visible:ring-transparent resize-none'
          {...field}
          value={field.value as string}
        />
      ),
      description: "This will update your anonymous message title.",
    },
    {
      title: "Update Username",
      name: "username",
      content: (field) => (
        <Input
          className='focus-visible:ring-transparent'
          placeholder='omsimos'
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
          placeholder='Tell us a little bit about yourself'
          className='focus-visible:ring-transparent resize-none'
          {...field}
          value={field.value as string}
        />
      ),
      description: "This will be publicly displayed in your profile.",
    },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='pauseLink'
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
          {settingsData.map((data) => {
            const { title, name, content, description } = data;

            return (
              <AccordionItem value={name}>
                <AccordionTrigger className='text-sm'>{title}</AccordionTrigger>
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

        <Button type='submit' className='w-full'>
          <Check className='mr-2 h-4 w-4' />
          Update Profile
        </Button>
      </form>
    </Form>
  );
}
