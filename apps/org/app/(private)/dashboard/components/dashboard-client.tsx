"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  InboxIcon,
  ListChecksIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExportThemeDialog } from "@/components/export-theme-dialog";
import { type ExportOrg, exportMessagesAsZip } from "@/lib/export";
import {
  type ExportThemePrefs,
  loadExportThemePrefs,
  resolveExportTheme,
} from "@/lib/export-themes";
import { queryKeys } from "@/lib/query";
import type { MessagesResponse, OrgMessageItem } from "@/lib/query-types";
import { MessageCard } from "./message-card";

async function fetchMessages(cursor: string | null): Promise<MessagesResponse> {
  const url = cursor
    ? `/api/messages?cursor=${encodeURIComponent(cursor)}`
    : "/api/messages";
  const res = await fetch(url);
  if (res.status === 401) {
    // Session expired mid-dashboard — a Retry loop can't fix that.
    window.location.assign("/login");
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export function DashboardClient({ org }: { org: ExportOrg }) {
  const queryClient = useQueryClient();
  // Keyset cursor of every visited page; index = current page, so Prev/Next
  // walk the stack without numbered offsets.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  // Whole message objects (not ids) so a selection made on another page can
  // still be exported after navigating away from it.
  const [selected, setSelected] = useState<Map<string, OrgMessageItem>>(
    () => new Map(),
  );
  const [exporting, setExporting] = useState(false);
  // window-guarded initializer; only read inside the post-hydration dialog and
  // export handlers, so no SSR/hydration mismatch surface.
  const [themePrefs, setThemePrefs] = useState<ExportThemePrefs>(() =>
    loadExportThemePrefs(),
  );
  const exportTheme = resolveExportTheme(themePrefs);

  const cursor = cursors[page] ?? null;
  const query = useQuery({
    queryKey: queryKeys.messages(cursor),
    queryFn: () => fetchMessages(cursor),
    placeholderData: keepPreviousData,
  });

  const messages = query.data?.messages ?? [];
  const nextCursor = query.data?.nextCursor ?? null;

  function toggle(message: OrgMessageItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(message.id)) next.delete(message.id);
      else next.set(message.id, message);
      return next;
    });
  }

  const allOnPageSelected =
    messages.length > 0 && messages.every((m) => selected.has(m.id));

  function togglePage() {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const m of messages) {
        if (allOnPageSelected) next.delete(m.id);
        else next.set(m.id, m);
      }
      return next;
    });
  }

  function removeMessage(id: string) {
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    // A delete shifts every keyset boundary after it — refetch, don't patch.
    queryClient.invalidateQueries({ queryKey: queryKeys.allMessages() });
  }

  function goPrev() {
    setPage((p) => Math.max(0, p - 1));
  }

  function goNext() {
    if (!nextCursor) return;
    setCursors((prev) =>
      page + 1 < prev.length ? prev : [...prev, nextCursor],
    );
    setPage((p) => p + 1);
  }

  async function runExport(list: OrgMessageItem[]) {
    if (list.length === 0) {
      toast.info("No messages to export");
      return;
    }
    setExporting(true);
    const id = toast.loading(`Rendering 0/${list.length}…`);
    try {
      const { ok, failed } = await exportMessagesAsZip(
        list,
        org,
        exportTheme,
        (done, total) => {
          toast.loading(`Rendering ${done}/${total}…`, { id });
        },
      );
      toast.success(
        `Exported ${ok} image${ok === 1 ? "" : "s"}${
          failed ? ` (${failed} failed)` : ""
        }`,
        { id },
      );
    } catch {
      toast.error("Export failed", { id });
    } finally {
      setExporting(false);
    }
  }

  async function exportAll() {
    // Walk every page fresh from the top so "all" really means all,
    // independent of which pages have been visited.
    setExporting(true);
    try {
      const all: OrgMessageItem[] = [];
      let c: string | null = null;
      do {
        const res: MessagesResponse = await fetchMessages(c);
        all.push(...res.messages);
        c = res.nextCursor;
      } while (c);
      await runExport(all);
    } catch {
      toast.error("Couldn't load all messages to export");
      setExporting(false);
    }
  }

  function exportSelected() {
    runExport([...selected.values()]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Inbox</h1>
          <p className="text-muted-foreground text-sm">
            Anonymous messages sent to your organization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="outline"
              onClick={togglePage}
              disabled={exporting}
              aria-pressed={allOnPageSelected}
              aria-label={allOnPageSelected ? "Deselect page" : "Select page"}
            >
              <ListChecksIcon />
              <span className="hidden sm:inline">
                {allOnPageSelected ? "Deselect page" : "Select page"}
              </span>
            </Button>
          )}
          <ExportThemeDialog
            prefs={themePrefs}
            onSave={setThemePrefs}
            sample={messages[0] ?? null}
          />
          {selected.size > 0 ? (
            <>
              <Button
                variant="outline"
                onClick={() => setSelected(new Map())}
                disabled={exporting}
              >
                <XIcon /> Clear
              </Button>
              <Button onClick={exportSelected} disabled={exporting}>
                {exporting ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <DownloadIcon />
                )}
                Download selected ({selected.size})
              </Button>
            </>
          ) : (
            <Button
              onClick={exportAll}
              disabled={exporting || messages.length === 0}
            >
              {exporting ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <DownloadIcon />
              )}
              Download all images
            </Button>
          )}
        </div>
      </div>

      {query.isPending ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
          <Loader2Icon className="animate-spin" /> Loading…
        </div>
      ) : query.isError ? (
        <div className="text-destructive py-16 text-center text-sm">
          Couldn't load messages.{" "}
          <Button
            variant="link"
            onClick={() => query.refetch()}
            className="text-destructive h-auto p-0 underline"
          >
            Retry
          </Button>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
          <InboxIcon className="size-8" />
          <div>
            <p className="font-medium">
              {page === 0 ? "No messages yet" : "No messages on this page"}
            </p>
            <p className="text-sm">
              {page === 0
                ? "Share your submit link to start receiving anonymous messages."
                : "Head back to the previous page."}
            </p>
          </div>
          {page > 0 && (
            <Button variant="outline" size="sm" onClick={goPrev}>
              <ChevronLeftIcon /> Previous
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {messages.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              org={org}
              theme={exportTheme}
              selected={selected.has(m.id)}
              onToggle={toggle}
              onDeleted={removeMessage}
            />
          ))}
        </div>
      )}

      {(page > 0 || nextCursor) && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={page === 0 || query.isFetching}
          >
            <ChevronLeftIcon /> Previous
          </Button>
          <span className="text-muted-foreground min-w-14 text-center text-xs">
            Page {page + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={
              !nextCursor || query.isPlaceholderData || query.isFetching
            }
          >
            Next <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
