import "@umamin/ui/globals.css";

import { Toaster } from "sonner";
import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import NextTopLoader from "nextjs-toploader";
import { Navbar } from "./components/navbar";
import { ThemeProvider } from "./components/utilities/theme-provider";

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
