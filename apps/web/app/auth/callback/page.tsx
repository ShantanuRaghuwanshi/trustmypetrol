"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

function Callback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const next = params.get("next") ?? "/";
    if (!supabase) {
      router.replace("/");
      return;
    }
    // detectSessionInUrl exchanges the ?code= automatically; wait for it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        router.replace(next);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, params]);

  return <p className="pump-meta">Signing you in…</p>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
