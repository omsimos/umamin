import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@umamin/ui/components/dialog";
import { Input } from "@umamin/ui/components/input";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAppNavigate } from "@/lib/navigation";
import { deleteAccountAction } from "./actions";

// apps/www drove this with a `<form action>` + useActionState + useFormStatus.
// Ported to useMutation + callAction: the action returns `{ redirect }`, which
// the client turns into a navigation (after clearing the cache).
export function DangerSettings() {
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();
  const navigate = useAppNavigate();

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccountAction(confirmText),
    onSuccess: (res) => {
      queryClient.clear();
      const to = "redirect" in res ? res.redirect : "/login";
      navigate(to, { replace: true });
    },
    onError: () => {
      toast.error("Couldn't delete account. Please try again.");
    },
  });

  return (
    <div className="border-t-2 border-dashed border-muted pt-8">
      <Alert>
        <AlertTitle>Danger Zone</AlertTitle>
        <AlertDescription>
          <span>
            This action will permanently delete your profile and messages. All
            of your data will be removed from our servers forever.
          </span>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="mt-6 w-full text-red-500 hover:text-red-500"
              >
                Delete Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-w-[95%] rounded-md">
              <DialogHeader>
                <DialogTitle>Are you absolutely sure?</DialogTitle>
                <DialogDescription>
                  This will permanently delete your account and remove your data
                  from our servers. Type{" "}
                  <span className="text-yellow-500">delete my account</span> to
                  confirm.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  deleteMutation.mutate();
                }}
              >
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Enter confirmation text"
                />
                <Button
                  disabled={
                    deleteMutation.isPending ||
                    confirmText !== "delete my account"
                  }
                  type="submit"
                  variant="secondary"
                  className="mt-3 w-full"
                >
                  {deleteMutation.isPending && (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete Account
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </AlertDescription>
      </Alert>
    </div>
  );
}
