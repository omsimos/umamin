import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";
import { Progress } from "@umamin/ui/components/progress";

const AdContainer = dynamic(() => import("@umamin/ui/ad"));

type Props = {
  type: string;
  description: string;
  open: boolean;
  onProgressComplete?: () => void;
  // eslint-disable-next-line no-unused-vars
  onOpenChange: (open: boolean) => void;
};

export function ProgressDialog({
  type,
  description,
  open,
  onOpenChange,
  onProgressComplete,
}: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setProgress(0);

      const duration = 5000;
      const intervalTime = 100;
      const totalIntervals = duration / intervalTime;
      let currentInterval = 0;

      const interval = setInterval(() => {
        currentInterval += 1;
        setProgress(Math.min(100, (currentInterval / totalIntervals) * 100));

        if (currentInterval >= totalIntervals) {
          clearInterval(interval);
          toast.success(`${type} sent successfully`);

          if (onProgressComplete) {
            onProgressComplete();
          }
        }
      }, intervalTime);

      return () => clearInterval(interval);
    }
  }, [open, type]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="px-0 max-w-full">
        <AlertDialogHeader className="px-4">
          <AlertDialogTitle>
            {progress === 100 ? `${type} Sent` : `Sending ${type}`}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AdContainer className="w-full" slotId="9163326848" />

        <AlertDialogFooter className="px-4">
          {progress !== 100 ? (
            <Progress value={progress} className="h-2" />
          ) : (
            <AlertDialogAction disabled={progress !== 100}>
              Continue
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
