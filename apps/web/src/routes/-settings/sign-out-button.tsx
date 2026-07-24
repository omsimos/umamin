import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { useAppNavigate } from "@/lib/navigation";
import { logoutAction } from "./actions";

// apps/www bound `<form action={logout}>` + useFormStatus. Ported to
// useMutation + callAction: logout returns `{ redirect }`, turned into a
// navigation after the cache is cleared.
export function SignOutButton() {
  const queryClient = useQueryClient();
  const navigate = useAppNavigate();

  const mutation = useMutation({
    mutationFn: logoutAction,
    onSuccess: (res) => {
      queryClient.clear();
      const to = "redirect" in res ? res.redirect : "/login";
      navigate(to, { replace: true });
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
