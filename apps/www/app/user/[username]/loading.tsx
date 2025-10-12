import { Button } from "@umamin/ui/components/button";
import { MessageSquareMoreIcon, UserPlusIcon } from "lucide-react";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";

export default function Loading() {
  return (
    <section className="max-w-xl mx-auto container">
      <UserCardSkeleton />

      <div className="flex gap-2 mt-6 w-full">
        <Button variant="outline" disabled className="flex-1">
          <UserPlusIcon />
          Follow
        </Button>

        <Button variant="outline" className="flex-1">
          <MessageSquareMoreIcon />
          Message
        </Button>
      </div>
    </section>
  );
}
