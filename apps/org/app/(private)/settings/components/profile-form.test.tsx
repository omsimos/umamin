import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  updateProfileAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/actions/account", () => ({
  updateProfileAction: (...args: unknown[]) =>
    mocks.updateProfileAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { ProfileForm } from "./profile-form";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateProfileAction.mockResolvedValue({ success: true });
});

describe("ProfileForm message character limit", () => {
  it("renders an unset limit as blank and submits null", async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        displayName="Acme"
        question="Ask us anything"
        acceptingMessages={true}
        messageCharLimit={null}
      />,
    );

    const input = screen.getByLabelText("Message character limit");
    expect(input).toHaveValue(null);
    expect(input).toHaveAttribute("min", "100");
    expect(input).toHaveAttribute("max", "5000");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocks.updateProfileAction).toHaveBeenCalledWith({
        displayName: "Acme",
        question: "Ask us anything",
        acceptingMessages: true,
        messageCharLimit: null,
      }),
    );
  });

  it("submits a configured limit as a number", async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        displayName={null}
        question="Ask us anything"
        acceptingMessages={false}
        messageCharLimit={250}
      />,
    );

    const input = screen.getByLabelText("Message character limit");
    expect(input).toHaveValue(250);
    await user.clear(input);
    await user.type(input, "500");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocks.updateProfileAction).toHaveBeenCalledWith({
        displayName: undefined,
        question: "Ask us anything",
        acceptingMessages: false,
        messageCharLimit: 500,
      }),
    );
  });
});
