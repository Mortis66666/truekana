"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AccountControl() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await getSupabaseClient().auth.signOut();
    setUser(null);
  }

  if (loading) return <span className="account-loading">Checking account...</span>;

  if (!user) {
    return <Link className="account-link account-action" href="/login"><span className="header-icon" aria-hidden="true">↪</span> Sign in</Link>;
  }

  return (
    <div className="account-control">
      <Link className="account-link account-action" href="/dashboard"><span className="header-icon" aria-hidden="true">▦</span> Study sets</Link>
      <span className="account-email" title={user.email ?? "Signed-in user"}><span className="header-icon" aria-hidden="true">●</span>{user.email}</span>
      <button className="account-button account-action" onClick={signOut}><span className="header-icon" aria-hidden="true">↗</span> Sign out</button>
    </div>
  );
}