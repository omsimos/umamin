import { useEffect } from "react";
import { useAppNavigate } from "@/lib/navigation";
import { isStandaloneMode } from "@/lib/pwa";

// The installed app launches at /feed (manifest start_url), so it never loads
// the marketing landing. This is the safety net for the rare in-app navigation
// back to "/": standalone users are sent to the app home instead. [#35]
export function PwaRedirect() {
  const navigate = useAppNavigate();

  useEffect(() => {
    if (isStandaloneMode()) {
      navigate("/feed", { replace: true });
    }
  }, [navigate]);

  return null;
}
