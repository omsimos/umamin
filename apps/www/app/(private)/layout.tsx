import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Menubar } from "@/components/menu-bar";
import { Navbar } from "@/components/navbar";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense>
        <Navbar />
        <Menubar />
      </Suspense>
      <div className="pt-24">{children}</div>
      <Footer />
    </>
  );
}
