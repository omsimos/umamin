import { Suspense } from "react";
import { BackHeader } from "@/components/back-header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <BackHeader />
      {/* Mobile: trim the shared pt-24 to the compact header height, plus the
          standalone safe-area inset so content clears the notch instead of
          hiding under the fixed header. Desktop keeps pt-24 for the Navbar. */}
      <div className="-mt-8 pt-[env(safe-area-inset-top)] lg:mt-0 lg:pt-0">
        {children}
      </div>
    </Suspense>
  );
}
