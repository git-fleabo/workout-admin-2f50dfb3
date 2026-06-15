import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_BUILD_LABEL } from "@/lib/build-info";
import {
  getSupabaseSession,
  signInWithPassword,
} from "@/lib/supabase-public";

export function SupabaseAuthGate({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSignedIn(Boolean(getSupabaseSession()?.access_token));
    setHydrated(true);
  }, []);

  if (hydrated && signedIn) return <>{children}</>;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
      setSignedIn(true);
      setPassword("");
    } catch {
      setError("Could not sign in.");
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
            <h1 className="text-base font-semibold leading-tight">Training Admin</h1>
            <p className="text-xs text-muted-foreground">
              Sign in with your approved account
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
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
            style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
        <p className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {APP_BUILD_LABEL}
        </p>
      </Card>
    </div>
  );
}
