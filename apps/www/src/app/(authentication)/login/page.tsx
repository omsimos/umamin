import Login from "@umamin/shared/pages/login/page";

export const metadata = {
  title: "Umamin — Login",
  description:
    "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
  keywords: [
    "Umamin login",
    "anonymous messaging login",
    "encrypted messages login",
  ],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    title: "Umamin — Login",
    description:
      "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
    url: "https://www.umamin.link/login",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — Login",
    description:
      "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
  },
};

export default function Page() {
  return <Login redirectPath="/inbox" className="mt-36" />;
}
