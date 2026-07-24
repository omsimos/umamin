import { createFileRoute } from "@tanstack/react-router";
import { GroupsHub } from "./-groups/groups-hub";
import { BackHeaderPage } from "./-shared/chrome";

export const Route = createFileRoute("/_private/groups")({
  head: () => ({ meta: [{ title: "Umamin — Groups" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  return (
    <BackHeaderPage>
      <div className="mx-auto min-h-screen w-full max-w-lg container pb-24">
        <GroupsHub />
      </div>
    </BackHeaderPage>
  );
}
