import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardTitle,
  CardFooter,
  CardHeader,
  CardDescription,
  CardContent,
} from "@umamin/ui/components/card";
import { RegisterForm } from "./components/form";
import { BrowserWarning } from "@umamin/ui/components/browser-warning";

export default async function Register() {
  const { user } = await getSession();

  if (user) {
    redirect("/inbox");
  }

  return (
    <section className="max-w-lg md:max-w-md container mt-36 min-h-screen">
      <BrowserWarning />
      <Card className="space-y-5 bg-transparent border-none">
        <CardHeader className="space-y-1 p-0">
          <CardTitle className="text-2xl flex justify-between items-center">
            <p>Umamin Account</p>
          </CardTitle>
          <CardDescription>
            To prevent account loss, we recommend Google OAuth.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <RegisterForm />
        </CardContent>

        <CardFooter className="flex flex-col items-start p-0">
          <div className="mt-4 text-center text-sm w-full">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </section>
  );
}