import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fullScreen: false }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useMatch: () => (mocks.fullScreen ? {} : undefined),
  Outlet: () => <div data-testid="outlet" />,
}));
vi.mock("@/components/navbar", () => ({
  Navbar: () => <nav aria-label="Navbar" />,
}));
vi.mock("@/components/menu-bar", () => ({
  Menubar: () => <nav aria-label="Menubar" />,
}));
vi.mock("@/components/footer", () => ({
  Footer: () => <footer>Footer</footer>,
}));

import { Route } from "@/routes/_private";

function Layout() {
  const Component = Route.options.component as () => React.ReactNode;
  return <Component />;
}

describe("_private layout chrome", () => {
  beforeEach(() => {
    mocks.fullScreen = false;
  });

  it("renders the navbar, menubar and footer around ordinary routes", () => {
    render(<Layout />);
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navbar" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Menubar" })).toBeVisible();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("renders only the outlet on the full-screen dm route", () => {
    mocks.fullScreen = true;
    render(<Layout />);
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByText("Footer")).toBeNull();
  });
});
