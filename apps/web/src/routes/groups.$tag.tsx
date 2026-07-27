import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Menubar } from "@/components/menu-bar";
import { Navbar } from "@/components/navbar";
import { BackHeaderPage } from "./-shared/chrome";

// Public group surface (`/groups/$tag` + `/groups/$tag/chat`). Unlike the
// private hub these routes are NOT auth-gated — the group page supports
// signed-out viewers ("Log in to join"). Renders the same chrome as apps/www's
// (public) layout (Navbar/Menubar/Footer) plus the mobile BackHeader.
export const Route = createFileRoute("/groups/$tag")({
  component: GroupTagLayout,
});

function GroupTagLayout() {
  return (
    <>
      <Suspense>
        <Navbar />
        <Menubar />
      </Suspense>
      <div className="pt-24">
        <BackHeaderPage>
          <Outlet />
        </BackHeaderPage>
      </div>
      <Footer />
    </>
  );
}
