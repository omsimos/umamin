import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";

import Providers from "./providers";
import { Navbar } from "@/components/navbar";

import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <Navbar />
          <div className="pt-24">{children}</div>
        </Providers>
        <GoogleAnalytics gaId="G-FGYK94W3YB" />
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
