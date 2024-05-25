"use client";

import { useState, useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

export function BrowserWarning() {
  const [isFb, setIsFb] = useState(false);

  useEffect(() => {
    if (navigator.userAgent.match(/FBAN|FBAV/i)) {
      setIsFb(true);
    }
  }, []);

  return (
    <>
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
