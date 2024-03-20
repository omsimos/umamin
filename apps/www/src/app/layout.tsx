import "@umamin/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "@umamin/ui/lib/utils";
import NextTopLoader from "nextjs-toploader";
import { Navbar } from "./components/navbar";
import { Toaster } from "@umamin/ui/components/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Umamin",
  description: "💌 The ultimate platform for anonymous messages!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body
        className={cn(inter.className, "bg-background text-foreground dark")}
      >
        <NextTopLoader />
        <Toaster />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
