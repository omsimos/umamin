import { Suspense } from "react";
import { BackHeader } from "@/components/back-header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <BackHeader />
      {/* mobile compact header: trim the shared pt-24; desktop keeps it for the Navbar */}
      <div className="-mt-8 lg:mt-0">{children}</div>
    </Suspense>
  );
}
