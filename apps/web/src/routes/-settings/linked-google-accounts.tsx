import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
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
import { Avatar, AvatarImage } from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Card, CardHeader } from "@umamin/ui/components/card";
import { Label } from "@umamin/ui/components/label";
import { useState } from "react";
import { toast } from "sonner";
import { BlobatarFallback } from "@/components/blobatar-fallback";
import { TimeAgoVerbose } from "@/components/time-ago-verbose";
import { actionError } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import { queryKeys } from "@/lib/query";
import type { LinkedAccount, UserWithAccount } from "@/lib/types";
import { unlinkGoogleAccountAction } from "./actions";

export function LinkedGoogleAccounts({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<LinkedAccount | null>(null);

  const unlink = useMutation({
    mutationFn: async (account: LinkedAccount) => {
      const res = await unlinkGoogleAccountAction({ linkId: account.linkId });
      const err = actionError(res);
      if (err) throw new ExpectedError(err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
      toast.success("Google account disconnected.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (user.accounts.length === 0) {
    return (
      <Alert>
        <AlertTitle>Link Account</AlertTitle>
        <AlertDescription>
          <span>
            To prevent account loss, you may connect your account with Google.
            You can still login with your credentials.
          </span>
          <Button variant="secondary" asChild className="mt-6">
            {/* Server GET (Worker OAuth start), not a client route — a plain
                anchor does a full navigation. */}
            <a href="/auth/google?intent=link" className="w-full">
              Connect with Google
            </a>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const several = user.accounts.length > 1;

  return (
    <section>
      <Label>Google Account</Label>

      {several && (
        <p className="mt-2 text-sm text-muted-foreground">
          More than one Google account can sign in to this profile. Disconnect
          any you don't recognize.
        </p>
      )}

      <div className="mt-2 space-y-2">
        {user.accounts.map((account) => (
          <Card key={account.linkId}>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarImage
                    className="rounded-full"
                    src={account.picture ?? ""}
                    alt="Profile Picture"
                  />
                  <BlobatarFallback seed={user.id} />
                </Avatar>

                <div className="min-w-0 text-sm">
                  <p className="break-all">{account.email}</p>

                  <p className="text-muted-foreground">
                    Linked <TimeAgoVerbose date={account.createdAt} />
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start sm:self-auto"
                aria-label={several ? `Disconnect ${account.email}` : undefined}
                onClick={() => setPending(account)}
              >
                Disconnect
              </Button>
            </CardHeader>
          </Card>
        ))}
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this Google account?</AlertDialogTitle>
            <AlertDialogDescription>
              {`You won't be able to sign in with ${pending?.email ?? "it"} anymore, and your other devices will be signed out.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={unlink.isPending}
                variant="destructive"
                onClick={() => {
                  if (pending) unlink.mutate(pending);
                }}
              >
                Disconnect
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
