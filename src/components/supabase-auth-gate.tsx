import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_BUILD_LABEL } from "@/lib/build-info";
import {
  SUPABASE_SESSION_EVENT,
  SupabaseAuthRequiredError,
  clearSupabaseSession,
  clearSupabaseRecoveryUrl,
  getSupabaseRecoveryTokenFromUrl,
  getSupabaseSession,
  signInWithPassword,
  updatePasswordWithRecoveryToken,
} from "@/lib/supabase-public";
import {
  AccountNotApprovedError,
  hasCachedAccountApproval,
  verifyApprovedAccount,
} from "@/lib/supabase-people.browser";

export function SupabaseAuthGate({
  children,
  onAccountChanged,
}: {
  children: ReactNode;
  onAccountChanged?: () => void;
}) {
  const accountId = useRef(getSupabaseSession()?.user.id);
  const [retryable, setRetryable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function verify() {
      const token = getSupabaseRecoveryTokenFromUrl();
      if (token) {
        clearSupabaseSession();
        if (alive) {
          setRecoveryToken(token);
          setSignedIn(false);
          setHydrated(true);
        }
        return;
      }
      const session = getSupabaseSession();
      if (!session?.access_token) {
        if (alive) {
          setSignedIn(false);
          setHydrated(true);
        }
        return;
      }
      try {
        await verifyApprovedAccount();
        if (alive && getSupabaseSession()?.user.id === session.user.id) {
          setSignedIn(true);
          setRetryable(false);
          setError(null);
        }
      } catch (err) {
        if (!alive || (getSupabaseSession() && getSupabaseSession()?.user.id !== session.user.id))
          return;
        const denied =
          err instanceof AccountNotApprovedError || err instanceof SupabaseAuthRequiredError;
        if (denied) clearSupabaseSession();
        setSignedIn(!denied && hasCachedAccountApproval());
        setRetryable(!denied);
        setError(
          denied
            ? err instanceof Error
              ? err.message
              : "Sign in again."
            : "The connection was interrupted. Your sign-in and local workouts are kept.",
        );
      } finally {
        if (alive) setHydrated(true);
      }
    }
    void verify();
    const retry = () => setAttempt((value) => value + 1);
    const sessionChanged = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== "supabase-session") return;
      const userId = getSupabaseSession()?.user.id;
      if (userId !== accountId.current) {
        accountId.current = userId;
        setSignedIn(false);
        setHydrated(!userId);
        onAccountChanged?.();
      }
      if (!getSupabaseSession()) {
        setSignedIn(false);
        setRetryable(false);
        setHydrated(true);
        setError("Sign in again; your local workouts are kept.");
      } else retry();
    };
    window.addEventListener(SUPABASE_SESSION_EVENT, sessionChanged);
    window.addEventListener("storage", sessionChanged);
    window.addEventListener("online", retry);
    return () => {
      alive = false;
      window.removeEventListener(SUPABASE_SESSION_EVENT, sessionChanged);
      window.removeEventListener("storage", sessionChanged);
      window.removeEventListener("online", retry);
    };
  }, [attempt, onAccountChanged]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card
          role="status"
          aria-busy="true"
          className="flex items-center gap-3 border-border bg-card p-6 text-sm"
        >
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          Checking sign-in…
        </Card>
      </div>
    );
  }

  if (hydrated && signedIn)
    return (
      <>
        {retryable && (
          <div role="status" className="border-b bg-muted p-3 text-sm">
            {error}{" "}
            <Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
              Retry connection
            </Button>
          </div>
        )}
        {children}
      </>
    );

  const onPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!recoveryToken || newPassword.length < 8 || newPassword !== confirmPassword) return;
    setBusy(true);
    setError(null);
    try {
      await updatePasswordWithRecoveryToken(recoveryToken, newPassword);
      clearSupabaseRecoveryUrl();
      clearSupabaseSession();
      setRecoveryToken(null);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordUpdated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const login = await signInWithPassword(email.trim(), password);
      setPassword("");
      await verifyApprovedAccount();
      if (getSupabaseSession()?.user.id !== login.user.id) return;
      setRetryable(false);
      setSignedIn(true);
      setPassword("");
    } catch (err) {
      if (err instanceof AccountNotApprovedError || err instanceof SupabaseAuthRequiredError) {
        clearSupabaseSession();
        setRetryable(false);
      } else {
        setRetryable(Boolean(getSupabaseSession()));
      }
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm space-y-5 border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Train &amp; Track</h1>
            <p className="text-xs text-muted-foreground">
              {recoveryToken ? "Set a new password" : "Sign in with your approved account"}
            </p>
          </div>
        </div>

        {recoveryToken ? (
          <form onSubmit={onPasswordReset} className="space-y-3">
            <Input
              type="password"
              autoFocus
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              aria-label="New password"
              autoComplete="new-password"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              autoComplete="new-password"
            />
            {newPassword && newPassword.length < 8 && (
              <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
            )}
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={
                !newPassword || newPassword.length < 8 || newPassword !== confirmPassword || busy
              }
              className="h-11 w-full text-sm font-semibold"
              style={{
                backgroundImage: "var(--gradient-primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        ) : retryable ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm">
              {error}
            </p>
            <Button className="w-full" onClick={() => setAttempt((value) => value + 1)}>
              Retry connection
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            {passwordUpdated && (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Password updated. Sign in with your new password.
              </p>
            )}
            <Input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={!email.trim() || !password || busy}
              className="h-11 w-full text-sm font-semibold"
              style={{
                backgroundImage: "var(--gradient-primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>
        )}
        <p className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {APP_BUILD_LABEL}
        </p>
      </Card>
    </div>
  );
}
