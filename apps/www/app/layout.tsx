import { GoogleTagManager } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import Providers from "./providers";

import "./globals.css";
import { Suspense } from "react";
import { Menubar } from "@/components/menu-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Umamin",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <Suspense>
            <Navbar />
            <Menubar />
          </Suspense>

          <div className="pt-24">{children}</div>
          <Footer />
        </Providers>
      </body>

      <GoogleTagManager gtmId={process.env.GOOGLE_TAG_ID ?? ""} />

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
