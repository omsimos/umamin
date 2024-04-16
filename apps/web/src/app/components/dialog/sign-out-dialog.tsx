import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@umamin/ui/components/alert-dialog";
import { Icons } from "../utilities/icons";

export function SignOutDialog() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type='button'>
          <Icons.exit />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to sign out?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Sign out</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
