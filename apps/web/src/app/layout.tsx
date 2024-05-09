import "@umamin/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Navbar } from "./components/navbar";
import { Toaster } from "@umamin/ui/components/sonner";
import { ThemeProvider } from "./components/utilities/theme-provider";

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
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NextTopLoader showSpinner={false} />
          <Toaster />
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
