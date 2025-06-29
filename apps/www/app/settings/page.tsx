import { logout } from "@/lib/auth";
import { SignOutButton } from "./components/sign-out-button";

export default function SettingsPage() {
  return (
    <div className="grid place-items-center h-screen">
      <form action={logout}>
        <SignOutButton />
      </form>
    </div>
  );
}
