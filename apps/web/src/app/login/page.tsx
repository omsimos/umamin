import Link from "next/link";
import { cn } from "@ui/lib/utils";
import { getSession } from "@/lib/auth";
import { buttonVariants } from "@umamin/ui/components/button";
import {
  Card,
  CardTitle,
  CardFooter,
  CardHeader,
  CardDescription,
} from "@umamin/ui/components/card";
import { redirect } from "next/navigation";

export default async function Login() {
  const { user } = await getSession();

  if (user) {
    redirect("/inbox");
  }

  return (
    <section className="max-w-lg container mt-36">
      <Card className="space-y-5">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl flex justify-between items-center">
            <p>Login to proceed</p>
          </CardTitle>
          <CardDescription>
            The ultimate platform for anonymous messages!
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
