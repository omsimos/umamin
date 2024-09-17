import Register from "@umamin/shared/pages/register/page";

export const metadata = {
  title: "Umamin — Register",
  description:
    "Create an account on Umamin to start sending and receiving encrypted anonymous messages. Join our secure platform and ensure your privacy today.",
  keywords: [
    "Umamin register",
    "sign up for Umamin",
    "anonymous messaging sign up",
  ],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    title: "Umamin — Register",
    description:
      "Create an account on Umamin to start sending and receiving encrypted anonymous messages. Join our secure platform and ensure your privacy today.",
    url: "https://www.umamin.link/register",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — Register",
    description:
      "Create an account on Umamin to start sending and receiving encrypted anonymous messages. Join our secure platform and ensure your privacy today.",
  },
};

export default function Page() {
  return <Register redirectPath="/inbox" className="mt-36" />;
}
