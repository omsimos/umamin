import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chat")({
  component: Session,
});

function Session() {
  return null;
}
