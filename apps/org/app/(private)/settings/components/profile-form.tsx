"use client";

import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/actions/account";

export function ProfileForm({
  displayName,
  question,
  acceptingMessages,
}: {
  displayName: string | null;
  question: string;
  acceptingMessages: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(displayName ?? "");
  const [prompt, setPrompt] = useState(question);
  const [accepting, setAccepting] = useState(acceptingMessages);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfileAction({
        displayName: name.trim() || undefined,
        question: prompt.trim(),
        acceptingMessages: accepting,
      });
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated.");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc"
          maxLength={50}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="question">Prompt shown to senders</Label>
        <Textarea
          id="question"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={150}
          rows={2}
          disabled={pending}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Accepting messages</p>
          <p className="text-muted-foreground text-xs">
            Turn off to pause your public submit page.
          </p>
        </div>
        <Switch
          checked={accepting}
          onCheckedChange={setAccepting}
          disabled={pending}
          aria-label="Accepting messages"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
