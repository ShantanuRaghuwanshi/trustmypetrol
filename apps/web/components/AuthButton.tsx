"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthButton() {
  const supabase = getSupabaseBrowser();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase || !ready) return null;

  return session ? (
    <span className="auth-chip">
      {session.user.email}
      <button
        className="link-btn"
        onClick={() => supabase.auth.signOut()}
        type="button"
      >
        Sign out
      </button>
    </span>
  ) : (
    <Link href="/auth" className="btn-small">
      Sign in
    </Link>
  );
}
