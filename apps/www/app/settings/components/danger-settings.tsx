"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@umamin/ui/components/dialog";
import { Input } from "@umamin/ui/components/input";

import { Alert, AlertDescription, AlertTitle } from "@umamin/ui/components/alert";
import { Button } from "@umamin/ui/components/button";
import { DeleteButton } from "./danger-button";
import { deleteAccountAction } from "@/app/actions/user";

export function DangerSettings() {
  const [confirmText, setConfirmText] = useState("");
  return (
    <div className="border-t-2 border-dashed border-muted pt-8 mt-8">
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

              <form action={deleteAccountAction}>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Enter confirmation text"
                />
                <DeleteButton confirmText={confirmText} />
              </form>
            </DialogContent>
          </Dialog>
        </AlertDescription>
      </Alert>
    </div>
  );
}
