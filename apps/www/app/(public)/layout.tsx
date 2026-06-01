import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PublicMenubar } from "@/components/public-menu-bar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <Suspense fallback={null}>
        <PublicMenubar />
      </Suspense>
      <div className="pt-24">{children}</div>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
