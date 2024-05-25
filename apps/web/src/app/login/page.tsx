import Link from "next/link";
import { cn } from "@ui/lib/utils";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buttonVariants } from "@umamin/ui/components/button";
import {
  Card,
  CardTitle,
  CardFooter,
  CardHeader,
  CardDescription,
} from "@umamin/ui/components/card";
import { BrowserWarning } from "@umamin/ui/components/browser-warning";

export default async function Login() {
  const { user } = await getSession();

  if (user) {
    redirect("/inbox");
  }

  return (
    <section className="max-w-lg container mt-36">
      <BrowserWarning />
      <Card className="space-y-5">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl flex justify-between items-center">
            <p>Umamin Account</p>
          </CardTitle>
          <CardDescription>
            Login to proceed. New accounts will automatically be created.
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex flex-col items-start">
          <Link
            href="/login/google"
            className={cn(
              buttonVariants({
                variant: "default",
              }),
              "w-full",
            )}
            type="button"
          >
            Sign in with Google
          </Link>
        </CardFooter>
      </Card>
    </section>
  );
}
