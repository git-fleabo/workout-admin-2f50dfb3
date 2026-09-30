import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/supabase-log.browser", () => ({
  getLibraryClient: vi.fn(async () => ({
    exercises: [{ id: "exercise-1", toolkitSections: ["pike"] }],
  })),
}));
vi.mock("@/lib/supabase-mobility.browser", () => ({
  listMobilityDataClient: vi.fn(async () => ({
    runs: [
      {
        id: "pike-run",
        skill: "pike",
        status: "active",
        phase: "phase_1",
        planReceived: false,
        readiness: "unchecked",
        reviewOn: null,
      },
      {
        id: "bridge-run",
        skill: "bridge",
        status: "active",
        phase: "setup",
        planReceived: false,
        readiness: "shoulders_first",
        reviewOn: null,
      },
    ],
    assessments: [],
    drills: [{ id: "pike-drill", runId: "pike-run", exerciseId: "exercise-1", isActive: true }],
    sessions: [{ id: "pike-session", runId: "pike-run", date: "2026-09-29" }],
  })),
}));

import { MobilityPracticeOverview } from "@/components/mobility-practice-overview";

describe("mobility overview", () => {
  it("keeps Pike's log action independent of Bridge readiness", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MobilityPracticeOverview compact />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Pike & Head to Toe")).toBeInTheDocument();
    expect(screen.getByText("Bridge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log practice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Bridge readiness" })).toHaveAttribute(
      "href",
      "/mobility",
    );
    expect(screen.getByText(/Last practice 2026-09-29/)).toBeInTheDocument();
  });
});
