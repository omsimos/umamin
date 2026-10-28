import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { BanUserDialog } from "@/components/ban-user-dialog";
import { TimeAgo } from "@/components/time-ago";
import { resolveDmReportAction } from "@/lib/actions";
import type { DmReportItem } from "@/lib/dm/types";
import { ExpectedError } from "@/lib/expected-error";
import { Link } from "@/lib/navigation";
import { getActionError } from "@/lib/utils";

const queryKey = ["moderation", "dm-reports"] as const;

async function fetchDmReports(): Promise<DmReportItem[]> {
  const res = await fetch("/api/moderation/dm-reports", {
    credentials: "include",
  });
  const data = (await res.json()) as { data?: DmReportItem[]; error?: string };
  if (!res.ok || !data.data) {
    throw new Error(data.error ?? "Failed to load chat reports");
  }
  return data.data;
}

type Resolution = "dismissed" | "actioned";

export function DmReportQueue() {
  const queryClient = useQueryClient();
  const [banTarget, setBanTarget] = useState<DmReportItem | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: fetchDmReports,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({
      report,
      resolution,
    }: {
      report: DmReportItem;
      resolution: Resolution;
    }) => {
      const err = getActionError(
        await resolveDmReportAction({ id: report.id, resolution }),
      );
      if (err) throw new ExpectedError(err);
      return report;
    },
    onSuccess: (report) => {
      queryClient.setQueryData<DmReportItem[]>(queryKey, (current) =>
        current?.filter((r) => r.id !== report.id),
      );
    },
    onError: () => toast.error("Couldn't save that. Try again."),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load chat reports. Try again later.
      </p>
    );
  }
  if (!data?.length) {
    return <p className="text-sm text-muted-foreground">No open reports.</p>;
  }

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {data.map((report) => {
          const busy =
            resolveMutation.isPending &&
            resolveMutation.variables?.report.id === report.id;
          return (
            <li key={report.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{report.reason}</Badge>
                <span>
                  {report.reporter ? `@${report.reporter.username}` : "deleted"}{" "}
                  reported{" "}
                  {report.reported ? (
                    <Link
                      href={`/user/${report.reported.username}`}
                      className="underline underline-offset-2"
                    >
                      @{report.reported.username}
                    </Link>
                  ) : (
                    "a deleted account"
                  )}
                </span>
                <TimeAgo date={new Date(report.createdAt)} />
              </div>
              <ol className="space-y-1 rounded-md bg-muted/40 p-2 text-sm">
                {report.snapshot.map((m) => (
                  <li
                    key={m.seq}
                    className={cn(
                      "whitespace-pre-wrap break-words",
                      m.seq === report.messageSeq &&
                        "rounded bg-destructive/10 px-1 font-medium",
                    )}
                  >
                    <span className="text-xs text-muted-foreground">
                      {m.fromReporter ? "Reporter" : "Reported"}:{" "}
                    </span>
                    {m.text ?? (
                      <span className="italic text-muted-foreground">
                        unsent
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    resolveMutation.mutate({ report, resolution: "dismissed" })
                  }
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    resolveMutation.mutate({ report, resolution: "actioned" })
                  }
                >
                  Mark handled
                </Button>
                {report.reported && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setBanTarget(report)}
                  >
                    Ban @{report.reported.username}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {banTarget?.reported && (
        <BanUserDialog
          username={banTarget.reported.username}
          banned={false}
          open
          onOpenChange={(open) => !open && setBanTarget(null)}
          onSuccess={() =>
            resolveMutation.mutate({
              report: banTarget,
              resolution: "actioned",
            })
          }
        />
      )}
    </>
  );
}
