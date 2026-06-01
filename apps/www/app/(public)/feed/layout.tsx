import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AppHeader />
      {/* shared layout pads pt-24 for the taller Navbar; trim toward the compact header */}
      <div className="-mt-8">{children}</div>
    </Suspense>
  );
}
