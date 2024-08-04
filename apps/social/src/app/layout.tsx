import "@umamin/ui/globals.css";
import Script from "next/script";
import { Toaster } from "sonner";
import { GeistSans } from "geist/font/sans";
import NextTopLoader from "nextjs-toploader";
import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@umamin/ui/components/theme-provider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "black",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.umamin.link"),
  alternates: {
    canonical: "/",
  },
  title: "Umamin — The Platform for Anonymity",
  authors: [{ name: "Omsimos Collective" }],
  description:
    "Umamin is an open-source social platform for sending and receiving encrypted anonymous messages. Ensure your privacy and share your thoughts freely without revealing your identity. Perfect for secure communication and anonymous interactions.",
  keywords: [
    "anonymous messaging",
    "open-source platform",
    "encrypted messages",
    "privacy",
    "anonymity",
  ],
  openGraph: {
    type: "website",
    siteName: "Umamin",
    url: "https://www.umamin.link",
    title: "Umamin — The Platform for Anonymity",
    description:
      "Umamin is an open-source social platform for sending and receiving encrypted anonymous messages. Ensure your privacy and share your thoughts freely without revealing your identity. Perfect for secure communication and anonymous interactions.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — The Platform for Anonymity",
    description:
      "Umamin is an open-source social platform for sending and receiving encrypted anonymous messages. Ensure your privacy and share your thoughts freely without revealing your identity. Perfect for secure communication and anonymous interactions.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
            position="top-right"
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

      {process.env.NODE_ENV === "production" && (
        <Script
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4274133898976040"
          crossOrigin="anonymous"
        />
      )}
    </html>
  );
}
