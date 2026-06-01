import { AppHeader } from "@/components/app-header";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PublicMain } from "@/components/public-main";
import { PublicMenubar } from "@/components/public-menu-bar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <AppHeader />
      <PublicMenubar />
      <PublicMain>{children}</PublicMain>
      <Footer />
    </>
  );
}
