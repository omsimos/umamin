"use client";

import { Button } from "@umamin/ui/components/button";
import { CheckIcon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { submitUrl } from "@/lib/constants";

export function CopyLinkButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(submitUrl(username));
      setCopied(true);
      toast.success("Submit link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <CheckIcon /> : <LinkIcon />}
      <span className="hidden sm:inline">Copy link</span>
    </Button>
  );
}
