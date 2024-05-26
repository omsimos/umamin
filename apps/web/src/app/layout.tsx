import "@umamin/ui/globals.css";

import { Toaster } from "sonner";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import NextTopLoader from "nextjs-toploader";
import { Navbar } from "./components/navbar";
import { ThemeProvider } from "@umamin/ui/components/theme-provider";

export const metadata: Metadata = {
  title: "Umamin — The Platform for Anonymity",
  description:
    "An open-source platform for anonymously sending and receiving messages. Share your thoughts and feelings without revealing your identity!",
  robots: "index, follow",
  openGraph: {
    type: "website",
    title: "Umamin — The Platform for Anonymity",
    description:
      "An open-source platform for anonymously sending and receiving messages. Share your thoughts and feelings without revealing your identity!",
    // images: [],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NextTopLoader showSpinner={false} />
          <Toaster
            theme="dark"
            className="toaster group"
            toastOptions={{
              classNames: {
                toast:
                  "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
                description: "group-[.toast]:text-muted-foreground",
                actionButton:
                  "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                cancelButton:
                  "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
              },
            }}
          />
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
