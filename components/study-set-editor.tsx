"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StudySetForm, { type Deck, type StudySettings } from "@/components/study-set-form";
import { getSupabaseClient } from "@/lib/supabase/client";

async function authFetch(path: string, init?: RequestInit) {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) throw new Error("Please sign in to continue.");
  return fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${data.session.access_token}` } });
}

export default function StudySetEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [initial, setInitial] = useState<{ name: string; deckIds: string[]; settings: Partial<StudySettings> }>();
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      authFetch("/api/decks"),
      id ? authFetch(`/api/study-sets/${id}`) : Promise.resolve(null),
    ]).then(async ([deckResponse, setResponse]) => {
      if (deckResponse.status === 401 || setResponse?.status === 401) {
        const next = id ? `/study-sets/${id}/settings` : "/study-sets/new";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!deckResponse.ok) {
        const payload = await deckResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Could not load available decks.");
      }
      const deckPayload = await deckResponse.json();
      setDecks(deckPayload.decks);
      if (setResponse) {
        if (!setResponse.ok) throw new Error("Could not load this study set.");
        const payload = await setResponse.json();
        setInitial({
          name: payload.studySet.name,
          deckIds: payload.studySet.study_set_decks.map((item: { deck_id: string }) => item.deck_id),
          settings: payload.studySet.settings,
        });
      }
    }).catch(errorValue => setError(errorValue instanceof Error ? errorValue.message : "Could not load the editor."));
  }, [id, router]);
  async function save(data: { name: string; deckIds: string[]; settings: StudySettings }) {
    const response = await authFetch(id ? `/api/study-sets/${id}` : "/api/study-sets", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { name: data.name, decks: data.deckIds, settings: data.settings } : { name: data.name, deckIds: data.deckIds, settings: data.settings }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "Could not save this study set.");
    }
    const payload = await response.json();
    router.push(id ? `/study-sets/${id}` : `/study-sets/${payload.studySet.id}`);
  }
  return <main className="account-page"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark" aria-hidden="true">字</span><span>TrueKana</span></Link><div className="topbar-actions"><Link className="text-button header-link back-link" href={id ? `/study-sets/${id}` : "/dashboard"}><span aria-hidden="true">←</span> Back</Link></div></header><section className="account-content narrow-content"><div className="page-heading"><div><p className="eyebrow">{id ? "Edit study set" : "New study set"}</p><h1>{id ? "Tune your practice." : "Build your practice."}</h1><p className="muted">Choose the cards and behavior that belong to this study set.</p></div></div>{error ? <p className="api-error" role="alert">{error}</p> : (id && !initial) ? <div className="empty-state"><div className="loader" /><p>Loading settings...</p></div> : <StudySetForm decks={decks} initialName={initial?.name} initialDeckIds={initial?.deckIds} initialSettings={initial?.settings} submitLabel={id ? "Save settings" : "Create study set"} onSubmit={save} />}</section></main>;
}
