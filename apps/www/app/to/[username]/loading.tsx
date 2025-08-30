import { LockIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatFormSkeleton } from "./components/chat-form-skeleton";

export default function Loading() {
  return (
    <>
      <div className="w-full max-w-xl container">
        <section className="border flex flex-col w-full pt-0 rounded-xl bg-card">
          <div className="bg-background border-b w-full item-center px-6 py-4 rounded-t-2xl flex justify-between flex-row">
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">To:</span>
              <Skeleton className="h-4 w-24" />
            </div>

            <span className="font-medium text-muted-foreground">umamin</span>
          </div>

          <ChatFormSkeleton />
        </section>
      </div>

      <div className="mt-4 text-muted-foreground text-sm flex items-center justify-center">
        <LockIcon className="h-4 w-4 mr-2" />
        Advanced Encryption Standard
        <LockIcon className="h-4 w-4 ml-2" />
      </div>

      {/* Skeleton for UnauthenticatedDialog - just a placeholder since it's conditional */}
      <div className="hidden">
        <Skeleton className="h-32 w-64" />
      </div>
    </>
  );
}
