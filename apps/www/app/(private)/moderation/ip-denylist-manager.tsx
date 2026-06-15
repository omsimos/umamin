"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { allowIpAction, denyIpAction } from "@/app/actions/moderation";
import { getActionError } from "@/lib/utils";

const QUERY_KEY = ["moderation", "ip-denylist"] as const;

async function fetchDenylist(): Promise<string[]> {
  const res = await fetch("/api/moderation/ip-denylist");
  const data = (await res.json()) as { ips?: string[]; error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error ?? "Failed to load denylist");
  }
  return data.ips ?? [];
}

export function IpDenylistManager() {
  const queryClient = useQueryClient();
  const [ip, setIp] = useState("");

  const { data: ips, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchDenylist,
  });

  const denyMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await denyIpAction({ ip: value });
      const error = getActionError(res);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setIp("");
      toast.success("IP blocked.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't block IP.");
    },
  });

  const allowMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await allowIpAction({ ip: value });
      const error = getActionError(res);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("IP unblocked.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't unblock IP.");
    },
  });

  return (
    <div className="space-y-4">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = ip.trim();
          if (value && !denyMutation.isPending) {
            denyMutation.mutate(value);
          }
        }}
      >
        <Input
          value={ip}
          onChange={(e) => setIp(e.currentTarget.value)}
          placeholder="IPv4 or IPv6 address"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={denyMutation.isPending || !ip.trim()}>
          {denyMutation.isPending && (
            <Loader2Icon className="size-4 animate-spin" />
          )}
          Block
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : ips && ips.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {ips.map((entry) => (
            <li
              key={entry}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span className="break-all font-mono text-sm">{entry}</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Unblock ${entry}`}
                disabled={allowMutation.isPending}
                onClick={() => allowMutation.mutate(entry)}
              >
                <Trash2Icon className="size-4 text-red-500" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No blocked IPs.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Per-IP block. A shared IP (mobile/CGNAT/office) affects everyone behind
        it, and it takes effect within ~30s. For a persistent attacker, prefer
        the Vercel WAF (blocks at the edge before the request reaches Umamin).
      </p>
    </div>
  );
}
