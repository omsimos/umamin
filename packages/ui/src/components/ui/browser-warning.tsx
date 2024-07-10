"use client";

import { useState, useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";

export default function BrowserWarning() {
  const [isFb, setIsFb] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (navigator.userAgent.match(/FBAN|FBAV/i)) {
      setIsFb(true);
      setOpen(true);
    }
  }, []);

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center">
              <TriangleAlert className="w-4 h-4 mr-1 text-yellow-500" />
              In-app browser detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              Facebook in-app browser detected, click the "..." menu and choose
              "Open in External Browser"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isFb && (
        <Alert className="my-4" variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Facebook in-app browser detected, please use an external browser to
            avoid running into issues.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
