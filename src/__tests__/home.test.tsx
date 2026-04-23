import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders the hero heading", () => {
    render(<Home />);
    expect(screen.getByText(/Cancel the SaaS/)).toBeInTheDocument();
  });

  it("renders the skills CTA", () => {
    render(<Home />);
    expect(screen.getByText(/Browse 6 free skills/)).toBeInTheDocument();
  });
});
