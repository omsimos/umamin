"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

export default function BrowserWarning() {
  const isFbAgent = /FBAN|FBAV/i.test(navigator.userAgent);
  const [open, setOpen] = useState(isFbAgent);

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center">
              <TriangleAlertIcon className="w-4 h-4 mr-1 text-yellow-500" />
              In-app browser detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              Facebook in-app browser detected, click the &quot;...&quot; menu
              and choose &quot;Open in External Browser&quot;
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isFbAgent && (
        <Alert className="my-4" variant="destructive">
          <TriangleAlertIcon className="h-4 w-4" />
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
