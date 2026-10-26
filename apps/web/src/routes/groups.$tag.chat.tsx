import { createFileRoute, redirect } from "@tanstack/react-router";

// Group chat was removed. Old links (bookmarks, past mention notifications)
// land on the group page instead of a 404.
export const Route = createFileRoute("/groups/$tag/chat")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/groups/$tag", params, statusCode: 301 });
  },
});
