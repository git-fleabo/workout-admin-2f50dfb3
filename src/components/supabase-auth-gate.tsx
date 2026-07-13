import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_BUILD_LABEL } from "@/lib/build-info";
import {
  clearSupabaseSession,
  clearSupabaseRecoveryUrl,
  getSupabaseRecoveryTokenFromUrl,
  getSupabaseSession,
  signInWithPassword,
  updatePasswordWithRecoveryToken,
} from "@/lib/supabase-public";
import { verifyApprovedAccount } from "@/lib/supabase-people.browser";

export function SupabaseAuthGate({ children }: { children: ReactNode }) {
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
        if (alive) setSignedIn(true);
      } catch {
        clearSupabaseSession();
        if (alive) {
          setSignedIn(false);
          setError("This account is not approved for this app.");
        }
      } finally {
        if (alive) setHydrated(true);
      }
    }
    verify();
    return () => {
      alive = false;
    };
  }, []);

  if (hydrated && signedIn) return <>{children}</>;

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
      await signInWithPassword(email.trim(), password);
      await verifyApprovedAccount();
      setSignedIn(true);
      setPassword("");
    } catch (err) {
      clearSupabaseSession();
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
            <h1 className="text-base font-semibold leading-tight">Training Tracker</h1>
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
              autoComplete="new-password"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
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
              autoComplete="email"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
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
