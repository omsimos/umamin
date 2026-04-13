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
      <Navbar />
      <PublicMenubar />
      <div className="pt-24">{children}</div>
      <Footer />
    </>
  );
}
