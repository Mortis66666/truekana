"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountControl from "@/components/account-control";
import { getSupabaseClient } from "@/lib/supabase/client";

type StudySet = { id: string; name: string; settings: Record<string, unknown>; created_at: string; study_set_decks: { deck_id: string; decks: { name: string } | null }[] };

async function authFetch(path: string, init?: RequestInit) {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) return null;
  return fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${data.session.access_token}` } });
}

export default function StudySetDashboard() {
  const router = useRouter();
  const [sets, setSets] = useState<StudySet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    authFetch("/api/study-sets").then(async response => {
      if (!response) {
        router.replace("/login?next=%2Fdashboard");
        return;
      }
      if (response.status === 401) {
        throw new Error("Your sign-in session has expired. Please sign in again.");
      }
      if (!response.ok) throw new Error("Could not load your study sets.");
      setSets((await response.json()).studySets);
    }).catch(errorValue => setError(errorValue instanceof Error ? errorValue.message : "Could not load your study sets.")).finally(() => setLoading(false));
  }, [router]);
  return <main className="account-page"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">字</span><span>TrueKana</span></Link><div className="topbar-actions"><AccountControl /></div></header><section className="account-content"><div className="page-heading"><div><p className="eyebrow">Your library</p><h1>Study sets</h1><p className="muted">Pick up where you left off, or create a focused set for a new goal.</p></div><Link className="primary-button" href="/study-sets/new"><span aria-hidden="true">＋</span> New study set</Link></div>{loading && <div className="empty-state"><div className="loader" /><p>Loading your study sets...</p></div>}{error && <p className="api-error" role="alert">{error}</p>}{!loading && !sets.length && <div className="empty-state"><div className="empty-symbol">◎</div><h3>No study sets yet</h3><p>Create one from the decks you want to practice.</p><Link className="primary-button" href="/study-sets/new">Create your first set</Link></div>}<div className="study-set-grid">{sets.map(set => <article className="study-set-tile" key={set.id}><div><p className="eyebrow">Study set</p><h2>{set.name}</h2><p className="set-decks">{set.study_set_decks.map(item => item.decks?.name ?? item.deck_id).join(" · ")}</p></div><div className="tile-actions"><Link className="primary-button" href={`/study-sets/${set.id}`}><span aria-hidden="true">▶</span> Continue</Link><Link className="text-button header-link" href={`/study-sets/${set.id}/settings`}><span aria-hidden="true">⚙</span> Edit settings</Link></div></article>)}</div></section></main>;
}
