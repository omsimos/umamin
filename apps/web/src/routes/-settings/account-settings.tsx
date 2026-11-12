import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Button } from "@umamin/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@umamin/ui/components/collapsible";
import { ChevronsUpDownIcon, KeyIcon, ShieldAlertIcon } from "lucide-react";
import type { UserWithAccount } from "@/lib/types";
import { DangerSettings } from "./danger-settings";
import { LinkedGoogleAccounts } from "./linked-google-accounts";
import { PasswordForm } from "./password-form";

export function AccountSettings({ user }: { user: UserWithAccount }) {
  return (
    <div className="space-y-8">
      <LinkedGoogleAccounts user={user} />

      {!user.hasPassword && (
        <Alert>
          <ShieldAlertIcon className="h-5 w-5" />
          <AlertTitle>Password (optional)</AlertTitle>
          <AlertDescription>
            You can have another way of logging in by adding a password.
          </AlertDescription>
        </Alert>
      )}

      <Collapsible defaultOpen={true}>
        <CollapsibleTrigger asChild className="w-full">
          <Button
            variant="secondary"
            className="flex items-center justify-between text-muted-foreground border w-full"
          >
            <span className="flex items-center gap-2">
              <KeyIcon className="size-4" />
              <p>{user.hasPassword ? "Change Password" : "Set a Password"}</p>
            </span>

            <ChevronsUpDownIcon className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg p-4 pt-4 border">
          <PasswordForm hasPassword={user.hasPassword} />
        </CollapsibleContent>
      </Collapsible>

      <DangerSettings />
    </div>
  );
}
