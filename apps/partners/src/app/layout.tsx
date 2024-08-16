import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "@umamin/ui/globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "black",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://partners.umamin.link"),
  alternates: {
    canonical: "/",
  },
  title: "Umamin Partners — Anonymity at Scale",
  authors: [{ name: "Omsimos Collective" }],
  description:
    "Umamin Partners provides powerful tools that are Ideal for businesses, organizations, or individuals dealing with large volumes of anonymous feedback, surveys, or communications. It combines the security and privacy of the core platform with powerful management tools to optimize workflow.",
  keywords: [
    "anonymous messaging",
    "open-source platform",
    "encrypted messages",
    "privacy",
    "anonymity",
  ],
  openGraph: {
    type: "website",
    siteName: "Umamin Partners",
    url: "https://social.umamin.link",
    title: "Umamin Partners — Anonymity at Scale",
    description:
      "Umamin Partners provides powerful tools that are Ideal for businesses, organizations, or individuals dealing with large volumes of anonymous feedback, surveys, or communications. It combines the security and privacy of the core platform with powerful management tools to optimize workflow.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin Partners — Anonymity at Scale",
    description:
      "Umamin Partners provides powerful tools that are Ideal for businesses, organizations, or individuals dealing with large volumes of anonymous feedback, surveys, or communications. It combines the security and privacy of the core platform with powerful management tools to optimize workflow.",
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
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
