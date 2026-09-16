/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShellHost } from "./shell-host";

describe("shell dashboard host", () => {
  it("renders the first adint tenant through the shell ViewHost contract", () => {
    render(<ShellHost />);

    expect(screen.getByText("Ad intelligence")).toBeTruthy();
    expect(screen.getByText("Tenant").parentElement?.textContent).toContain("adint");
    expect(screen.getByTestId("view-shell-host").getAttribute("data-kitstack-host")).toBe("shell");
    expect(screen.getByText("brands on competitors, not on Ströer")).toBeTruthy();
  });

  it("lets the host navigate between the kit's registered Views", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<ShellHost />);

    fireEvent.click(screen.getByRole("button", { name: /Opportunities/ }));

    expect(screen.getByRole("heading", { name: "Opportunities" })).toBeTruthy();
    expect(screen.getByText(/No scored triggers yet/)).toBeTruthy();
    expect(screen.getByTestId("view-shell-host").getAttribute("data-kitstack-host")).toBe("shell");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/host?kit=adint&view=triggers");
    replaceState.mockRestore();
  });

  it("shows an honest empty state for the unscored trigger detail View", () => {
    render(<ShellHost initialView="trigger-detail" />);

    expect(screen.getByRole("heading", { name: "Opportunity detail" })).toBeTruthy();
    expect(screen.getByText(/No trigger selected/)).toBeTruthy();
  });
});
