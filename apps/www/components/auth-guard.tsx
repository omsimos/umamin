"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useSession } from "@/hooks/use-session";

type AuthGuardProps = {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  fallback?: ReactNode;
};

export function AuthGuard({
  children,
  requireAuth = true,
  redirectTo,
  fallback = null,
}: AuthGuardProps) {
  const router = useRouter();
  const { data, isPending } = useSession();
  const hasSession = !!data?.session;

  useEffect(() => {
    if (isPending) return;
    if (requireAuth && !hasSession) {
      router.replace(redirectTo ?? "/login");
      return;
    }
    if (!requireAuth && hasSession) {
      router.replace(redirectTo ?? "/inbox");
    }
  }, [isPending, hasSession, requireAuth, redirectTo, router]);

  if (isPending) return <>{fallback}</>;
  if (requireAuth && !hasSession) return <>{fallback}</>;
  if (!requireAuth && hasSession) return <>{fallback}</>;
  return <>{children}</>;
}
