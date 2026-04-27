import { redirect } from "next/navigation";

export function GET() {
  const apiOrigin = process.env.HONO_API_ORIGIN ?? process.env.API_ORIGIN;
  redirect(apiOrigin ? `${apiOrigin}/auth/google` : "/auth/google");
}
