import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { useAppNavigate } from "@/lib/navigation";
import { signOut } from "@/lib/sign-out";

// apps/www bound `<form action={logout}>` + useFormStatus. Ported to
// useMutation; the sign-out sequence lives in lib/sign-out.ts, and its
// `{ redirect }` turns into a navigation after the cache is cleared.
export function SignOutButton() {
  const queryClient = useQueryClient();
  const navigate = useAppNavigate();

  const mutation = useMutation({
    mutationFn: signOut,
    onSuccess: (res) => {
      queryClient.clear();
      navigate(res.redirect, { replace: true });
    },
    onError: () => toast.error("Couldn't sign out. Please try again."),
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
