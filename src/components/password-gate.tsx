import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  clearStoredSecret,
  getStoredSecret,
  setStoredSecret,
} from "@/lib/auth-middleware";
import { verifyAppSecret } from "@/lib/auth.functions";

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const verifyFn = useServerFn(verifyAppSecret);

  useEffect(() => {
    setUnlocked(Boolean(getStoredSecret()));
    setHydrated(true);
  }, []);

  const verify = useMutation({
    mutationFn: (pwd: string) => verifyFn({ data: { password: pwd } }),
    onSuccess: (res, pwd) => {
      if (res.ok) {
        setStoredSecret(pwd);
        setError(null);
        setUnlocked(true);
        setPassword("");
      } else {
        clearStoredSecret();
        setError("Wrong password. Try again.");
      }
    },
    onError: () => setError("Couldn't verify right now. Try again."),
  });

  if (!hydrated) return null;
  if (unlocked) return <>{children}</>;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    verify.mutate(password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm space-y-5 border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Training Log</h1>
            <p className="text-xs text-muted-foreground">Enter password to continue</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Access password"
            autoComplete="current-password"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={!password || verify.isPending}
            className="h-11 w-full text-sm font-semibold"
            style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
          >
            {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
