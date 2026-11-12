import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrgMessageItem } from "@/lib/query-types";

vi.mock("@/app/actions/message", () => ({
  deleteMessageAction: vi.fn(),
}));

vi.mock("@/lib/export", () => ({
  downloadCardImage: vi.fn(),
}));

import { MessageCard } from "./message-card";

afterEach(cleanup);

function renderCard(message: OrgMessageItem) {
  render(
    <MessageCard
      message={message}
      org={{ username: "acme" }}
      theme={{} as never}
      selected={false}
      onToggle={() => {}}
      onDeleted={() => {}}
    />,
  );
}

const base = {
  id: "m-1",
  question: "Tell us what you think",
  createdAt: new Date("2026-11-12T08:00:00.000Z").getTime(),
};

describe("MessageCard", () => {
  it("shows an undecryptable message as such and only allows delete", () => {
    renderCard({ ...base, content: "", decryptFailed: true });

    expect(
      screen.getByText("This message couldn't be decrypted."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save image" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete message" }),
    ).toBeEnabled();
  });

  it("shows a normal message and allows saving and selecting", () => {
    renderCard({ ...base, content: "Great event, thank you" });

    expect(screen.getByText("Great event, thank you")).toBeInTheDocument();
    expect(
      screen.queryByText("This message couldn't be decrypted."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save image" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Select" })).toBeEnabled();
  });
});
