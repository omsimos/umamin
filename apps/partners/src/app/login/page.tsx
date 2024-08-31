import Login from "@umamin/shared/pages/login/page";

export const metadata = {
  title: "Umamin Partners — Login",
  description:
    "Log in to Umamin Partners to manage anonymous feedback, surveys, and communications securely. Enhance your workflow with powerful tools and maintain privacy at every step.",
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
    title: "Umamin Partners — Login",
    description:
      "Log in to Umamin Partners to manage anonymous feedback, surveys, and communications securely. Enhance your workflow with powerful tools and maintain privacy at every step.",
    url: "https://partners.umamin.link/login",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin Partners — Login",
    description:
      "Log in to Umamin Partners to manage anonymous feedback, surveys, and communications securely. Enhance your workflow with powerful tools and maintain privacy at every step.",
  },
};

export default function Page() {
  return <Login redirectPath="/dashboard" />;
}
