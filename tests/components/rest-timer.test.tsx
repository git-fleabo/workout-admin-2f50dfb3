import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RestTimer } from "@/components/workout-logger/rest-timer";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function openTimer() {
  const result = render(<RestTimer />);
  fireEvent.click(screen.getByText("Rest timer · Optional"));
  return result;
}

describe("Manual rest timer", () => {
  it("requires a chosen duration and catches up after a delayed browser tick", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
    openTimer();
    expect(screen.getByRole("button", { name: "Start timer" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "90s" }));
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    expect(screen.getByRole("timer")).toHaveTextContent("1:30");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer")).toHaveTextContent("1:29");
    // Browsers can suspend interval callbacks while the app is in the background.
    vi.setSystemTime(new Date("2026-10-14T12:02:00Z"));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Rest finished. Continue when ready.");
    expect(screen.getByRole("button", { name: "Start timer" })).toBeEnabled();
  });

  it("rejects invalid durations, cancels a running timer, and clears its interval on unmount", () => {
    vi.useFakeTimers();
    const interval = vi.spyOn(window, "setInterval");
    const clear = vi.spyOn(window, "clearInterval");
    const result = openTimer();
    const input = screen.getByRole("spinbutton", { name: "Rest seconds" });
    for (const value of ["0", "-1", "0.5", "7201"]) {
      fireEvent.change(input, { target: { value } });
      expect(screen.getByRole("button", { name: "Start timer" })).toBeDisabled();
    }
    fireEvent.change(input, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel timer" }));
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    result.unmount();
    expect(clear).toHaveBeenCalledWith(interval.mock.results.at(-1)?.value);
  });
});
