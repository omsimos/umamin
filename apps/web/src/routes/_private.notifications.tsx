import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { NotificationListSkeleton } from "./-notifications/notification-skeleton";
import { NotificationsList } from "./-notifications/notifications-list";
import { PushPrompt } from "./-notifications/push-prompt";
import { BackHeaderPage } from "./-shared/chrome";

export const Route = createFileRoute("/_private/notifications")({
  head: () => ({ meta: [{ title: "Umamin — Notifications" }] }),
  pendingComponent: NotificationsPending,
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <BackHeaderPage>
      <main className="max-w-xl mx-auto min-h-screen container">
        <h1 className="text-lg font-semibold">Notifications</h1>

        <div className="mt-5">
          <PushPrompt />
          <NotificationsList />
        </div>
      </main>
    </BackHeaderPage>
  );
}

function NotificationsPending() {
  return (
    <BackHeaderPage>
      <main className="max-w-xl mx-auto min-h-screen container">
        <Skeleton className="h-7 w-40" />
        <div className="mt-5">
          <NotificationListSkeleton />
        </div>
      </main>
    </BackHeaderPage>
  );
}
