"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";
import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

export default function UnauthenticatedDialog() {
  const [open, onOpenChange] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    ...privateQueryDefaults,
  });

  const isLoggedIn = !!data?.user;

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      onOpenChange(true);
    }
  }, [isLoading, isLoggedIn]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-center">
            <TriangleAlertIcon className="w-4 h-4 mr-1 text-yellow-500" />
            You are not logged in
          </AlertDialogTitle>
          <AlertDialogDescription>
            Messages sent will not be saved in your inbox and you won&apos;t be
            able to see the reply from this user. Do you still want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link href="/login">Login</Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
