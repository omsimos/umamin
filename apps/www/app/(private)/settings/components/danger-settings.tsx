"use client";

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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAccount } from "@/lib/api-mutations";
import { DeleteButton } from "./danger-button";

export function DangerSettings() {
  const [confirmText, setConfirmText] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.clear();
      toast.success("Account deleted.");
      router.push("/login");
      router.refresh();
    },
    onError: (error) => {
      console.error(error);
      toast.error("Couldn't delete account.");
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
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate();
                }}
              >
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Enter confirmation text"
                />
                <DeleteButton
                  confirmText={confirmText}
                  isPending={mutation.isPending}
                />
              </form>
            </DialogContent>
          </Dialog>
        </AlertDescription>
      </Alert>
    </div>
  );
}
