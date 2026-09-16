import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "@/app/page";

vi.mock("@/services/kit.service", () => ({
  getAllKitCards: vi.fn(async () => []),
}));

describe("Home page", () => {
  it("renders the hero heading", async () => {
    render(await Home());
    expect(screen.getByText(/Cancel the SaaS/)).toBeInTheDocument();
  });

  it("renders the skills CTA", async () => {
    render(await Home());
    expect(screen.getAllByText(/Browse free skills/).length).toBeGreaterThan(0);
  });
});
