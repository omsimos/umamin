import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GOOGLE_AUTH_ERRORS } from "@/lib/google-auth-errors";
import { GoogleAuthErrorAlert } from "./google-auth-error-alert";

describe("GoogleAuthErrorAlert", () => {
  it("renders nothing without a code", () => {
    render(<GoogleAuthErrorAlert code={undefined} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders nothing for a code it does not know, including inherited object keys", () => {
    for (const code of ["nope", "constructor", "toString", "__proto__"]) {
      render(<GoogleAuthErrorAlert code={code} />);
      expect(screen.queryByRole("alert")).toBeNull();
      cleanup();
    }
  });

  it("renders the alert for a known code", () => {
    render(<GoogleAuthErrorAlert code="cancelled" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      GOOGLE_AUTH_ERRORS.cancelled.title,
    );
  });
});
