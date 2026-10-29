import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PresenceAvatar } from "./presence-avatar";

describe("PresenceAvatar", () => {
  // A static face is one <img>; the thinking face has to be inline SVG so the
  // motion stylesheet can reach its shapes.
  it("animates the face only while the partner is typing", () => {
    const { container, rerender } = render(
      <PresenceAvatar seed="x" alias="NightOwl" status="online" />,
    );
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();

    rerender(<PresenceAvatar seed="x" alias="NightOwl" status="typing" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
