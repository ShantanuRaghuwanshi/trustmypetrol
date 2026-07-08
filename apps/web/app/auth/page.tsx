"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

function AuthForm() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabase) {
    return (
      <p className="pump-meta">
        Sign-in isn&apos;t configured on this deployment (Supabase env vars are
        missing).
      </p>
    );
  }

  async function google() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase!.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
    }
    // on success the browser redirects away
  }

  async function sendCode() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStage("code");
  }

  async function verify() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase!.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace(next);
  }

  return (
    <div className="auth-panel">
      <h1>Sign in</h1>
      <p className="pump-meta" style={{ maxWidth: "48ch" }}>
        Sign in to file reports. One account per person is what keeps pump
        scores honest.
      </p>

      <button className="btn-outline" onClick={google} disabled={busy}>
        Continue with Google
      </button>

      <div className="divider">
        <span>or use an email code</span>
      </div>

      {stage === "email" ? (
        <>
          <input
            className="field"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <button
            className="btn-primary"
            onClick={sendCode}
            disabled={busy || !email.includes("@")}
          >
            {busy ? "Sending…" : "Send sign-in code"}
          </button>
        </>
      ) : (
        <>
          <p className="pump-meta">
            Enter the 6-digit code sent to {email.trim()}
          </p>
          <input
            className="field code"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={verify}
            disabled={busy || code.length !== 6}
          >
            {busy ? "Verifying…" : "Verify & sign in"}
          </button>
          <button className="link-btn" onClick={() => setStage("email")}>
            Use a different email
          </button>
        </>
      )}

      {error && <p className="error-note">{error}</p>}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
