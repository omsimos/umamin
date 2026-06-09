import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";

export default function Loading() {
  return (
    <section className="max-w-xl mx-auto min-h-screen container">
      <UserCardSkeleton />
    </section>
  );
}
