import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Link2OffIcon } from "lucide-react";
import { googleAuthError } from "@/lib/google-auth-errors";

const LINK_CODES = new Set(["no_account", "already_linked"]);

export function GoogleAuthErrorAlert({
  code,
  className,
}: {
  code: string | undefined;
  className?: string;
}) {
  const error = googleAuthError(code);
  if (!error) return null;

  return (
    <Alert variant="destructive" className={className}>
      {code !== undefined && LINK_CODES.has(code) && <Link2OffIcon />}
      <AlertTitle>{error.title}</AlertTitle>
      <AlertDescription>{error.description}</AlertDescription>
    </Alert>
  );
}
