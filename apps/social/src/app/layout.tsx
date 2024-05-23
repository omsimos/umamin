import "@umamin/ui/globals.css";

import { Toaster } from "sonner";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "@umamin/ui/components/theme-provider";

export const metadata: Metadata = {
  title: "Umamin Social — A Platform Built to Share Stories",
  description:
    "A social platform built for the Umamin community, connect with others by sharing your stories and experiences.",
  robots: "index, follow",
  openGraph: {
    type: "website",
    title: "Umamin Social — A Platform Built to Share Stories",
    description:
      "A social platform built for the Umamin community, connect with others by sharing your stories and experiences.",
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
