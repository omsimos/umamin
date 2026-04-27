"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClientErrorMessage } from "@/lib/api-client";
import { logout } from "@/lib/api-mutations";

export function SignOutButton() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
    onError: (error) => {
      toast.error(apiClientErrorMessage(error, "Couldn't sign out."));
    },
  });

  return (
    <Button
      type="button"
      disabled={mutation.isPending}
      variant="outline"
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? (
        <Loader2Icon className="animate-spin" />
      ) : (
        <LogOutIcon />
      )}
      Sign Out
    </Button>
  );
}
