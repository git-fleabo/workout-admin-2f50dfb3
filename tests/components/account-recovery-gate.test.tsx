import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import {
  clearSupabaseSession,
  getSupabaseSession,
  setSupabaseSession,
} from "@/lib/supabase-public";
vi.mock("@/lib/build-info", () => ({ APP_BUILD_LABEL: "Build test" }));
const mocks = vi.hoisted(() => ({ verify: vi.fn(), approved: false }));
vi.mock("@/lib/supabase-people.browser", () => ({
  verifyApprovedAccount: mocks.verify,
  hasCachedAccountApproval: () => mocks.approved,
  AccountNotApprovedError: class AccountNotApprovedError extends Error {},
}));
import { AccountNotApprovedError } from "@/lib/supabase-people.browser";
import { SupabaseAuthGate } from "@/components/supabase-auth-gate";
beforeEach(() => {
  window.localStorage.clear();
  mocks.approved = false;
  mocks.verify.mockReset();
  setSupabaseSession({ access_token: "access", refresh_token: "refresh", user: { id: "owner" } });
});
afterEach(() => vi.restoreAllMocks());
it("server rendering waits for verification without showing credentials or protected content", () => {
  const html = renderToString(
    <SupabaseAuthGate>
      <p>Private logger</p>
    </SupabaseAuthGate>,
  );
  expect(html).toContain("Checking sign-in");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("Private logger");
  expect(mocks.verify).not.toHaveBeenCalled();
});
it("a stored session shows a loading state until its approval check finishes", async () => {
  let release!: () => void;
  mocks.verify.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  render(
    <SupabaseAuthGate>
      <p>Private logger</p>
    </SupabaseAuthGate>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Checking sign-in");
  expect(screen.queryByRole("button", { name: "Sign in", exact: true })).toBeNull();
  expect(screen.queryByText("Private logger")).toBeNull();
  release();
  expect(await screen.findByText("Private logger")).toBeVisible();
  expect(getSupabaseSession()?.user.id).toBe("owner");
});
it("an account change hides the previous view until the new account is verified", async () => {
  let release!: () => void;
  mocks.verify.mockResolvedValueOnce({ id: "person" }).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const changed = vi.fn();
  render(
    <SupabaseAuthGate onAccountChanged={changed}>
      <p>Private logger</p>
    </SupabaseAuthGate>,
  );
  await screen.findByText("Private logger");
  setSupabaseSession({
    access_token: "second",
    refresh_token: "second-refresh",
    user: { id: "second-owner" },
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Checking sign-in");
  expect(screen.queryByText("Private logger")).toBeNull();
  expect(screen.queryByRole("button", { name: "Sign in", exact: true })).toBeNull();
  expect(changed).toHaveBeenCalledOnce();
  release();
  expect(await screen.findByText("Private logger")).toBeVisible();
});
it("a missing session still reaches the named sign-in form", async () => {
  clearSupabaseSession();
  render(
    <SupabaseAuthGate>
      <p>Private logger</p>
    </SupabaseAuthGate>,
  );
  expect(await screen.findByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Email" })).toBeVisible();
  expect(screen.getByLabelText("Password", { exact: true })).toBeVisible();
  expect(mocks.verify).not.toHaveBeenCalled();
});
it("transient verification failure retains sign-in and offers retry instead of an approval denial", async () => {
  mocks.verify
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValue({ id: "person" });
  render(
    <SupabaseAuthGate>
      <p>Logger</p>
    </SupabaseAuthGate>,
  );
  await screen.findByRole("button", { name: "Retry connection" });
  expect(getSupabaseSession()?.user.id).toBe("owner");
  expect(screen.queryByText("This account is not approved for this app.")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Retry connection" }));
  expect(await screen.findByText("Logger")).toBeVisible();
});
it("previously approved accounts can continue local work offline, then recover", async () => {
  mocks.approved = true;
  mocks.verify.mockRejectedValue(new TypeError("Offline"));
  render(
    <SupabaseAuthGate>
      <p>Logger</p>
    </SupabaseAuthGate>,
  );
  expect(await screen.findByText("Logger")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("local workouts are kept");
  mocks.verify.mockResolvedValue({ id: "person" });
  await userEvent.click(screen.getByRole("button", { name: "Retry connection" }));
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
});
it("actual approval denial clears sign-in while keeping drafts", async () => {
  window.localStorage.setItem("workout-session-draft:owner", "retained");
  mocks.approved = true;
  mocks.verify.mockRejectedValue(
    new AccountNotApprovedError("This account is not approved for this app."),
  );
  render(
    <SupabaseAuthGate>
      <p>Logger</p>
    </SupabaseAuthGate>,
  );
  await screen.findByText("This account is not approved for this app.");
  expect(getSupabaseSession()).toBeNull();
  expect(screen.queryByText("Logger")).toBeNull();
  expect(window.localStorage.getItem("workout-session-draft:owner")).toBe("retained");
});
it("a login that expires while using the app returns to sign-in without losing local work", async () => {
  mocks.verify.mockResolvedValue({ id: "person" });
  render(
    <SupabaseAuthGate>
      <p>Logger</p>
    </SupabaseAuthGate>,
  );
  await screen.findByText("Logger");
  window.localStorage.setItem("workout-session-draft:owner", "retained");
  clearSupabaseSession();
  expect(await screen.findByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(window.localStorage.getItem("workout-session-draft:owner")).toBe("retained");
});

it("a stale approval response cannot reopen the app after logout", async () => {
  let release!: () => void;
  mocks.verify.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  render(
    <SupabaseAuthGate>
      <p>Logger</p>
    </SupabaseAuthGate>,
  );
  await waitFor(() => expect(mocks.verify).toHaveBeenCalled());
  clearSupabaseSession();
  release();
  await screen.findByRole("button", { name: "Sign in", exact: true });
  expect(screen.queryByText("Logger")).toBeNull();
});
