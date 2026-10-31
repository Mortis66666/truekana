"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AccountControl from "@/components/account-control";
import KanjiCard, { type KanjiCardData } from "@/components/kanji-card";
import { getSupabaseClient } from "@/lib/supabase/client";

type StudyCard = KanjiCardData & {
  id: string;
  deck_id: string;
  seen?: boolean;
  progressStatus?: number;
};
type Settings = {
  autoSubmission?: boolean;
  showDefinitionAfterCorrect?: boolean;
  shuffle?: boolean;
};
type Stats = { totalCards: number; seenCards: number; correctCards: number };
type Batch = { cards: StudyCard[]; settings: Settings; stats: Stats };

async function studyFetch(path: string, init?: RequestInit) {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) throw new Error("Please sign in to continue.");
  return fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${data.session.access_token}`
    }
  });
}

function mapCards(cards: Array<Record<string, unknown>>) {
  return cards.map(card => ({
    id: String(card.id),
    deck_id: String(card.deck_id),
    seen: card.seen === true,
    question: String(card.kanji),
    answer: Array.isArray(card.reading) ? card.reading.map(String) : [],
    meaning: String(card.meaning),
    level: String(card.deck_id).replace("jlpt-", "").toUpperCase()
  })) as StudyCard[];
}

export default function StudySetStudy({ id }: { id: string }) {
  const router = useRouter();
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [index, setIndex] = useState(0);
  const [seenCount, setSeenCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [stats, setStats] = useState<Stats>({
    totalCards: 0,
    seenCards: 0,
    correctCards: 0
  });
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const prefetchRef = useRef<Promise<Batch> | null>(null);
  const requestIdRef = useRef(0);
  const initialLoadRef = useRef(false);

  const fetchBatch = useCallback(
    async (excludeIds: string[] = []): Promise<Batch> => {
      const requestId = ++requestIdRef.current;
      const exclude = excludeIds.length
        ? `&exclude=${encodeURIComponent(excludeIds.join(","))}`
        : "";
      console.debug("[TrueKana study queue] request", {
        requestId,
        excludeIds,
        isInitialLoad: excludeIds.length === 0
      });
      const response = await studyFetch(
        `/api/study-sets/${id}/queue?limit=10${exclude}${excludeIds.length ? "" : "&start=1"}`
      );
      if (response.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/study-sets/${id}`)}`
        );
        throw new Error("Authentication required.");
      }
      if (!response.ok) throw new Error("Could not load this study set.");
      const payload = await response.json();
      const loaded = mapCards(payload.cards ?? []);
      console.debug("[TrueKana study queue] response", {
        requestId,
        cardIds: loaded.map(item => item.id),
        stats: payload.stats
      });
      const nextCards =
        payload.settings?.shuffle === false
          ? loaded
          : [...loaded].sort(() => Math.random() - 0.5);
      return {
        cards: nextCards,
        settings: payload.settings ?? {},
        stats: payload.stats ?? { totalCards: 0, seenCards: 0, correctCards: 0 }
      };
    },
    [id, router]
  );

  const applyBatch = useCallback((batch: Batch, refreshStats = true) => {
    console.debug("[TrueKana study queue] apply batch", {
      cardIds: batch.cards.map(item => item.id),
      refreshStats
    });
    setCards(batch.cards);
    setSettings(batch.settings);
    if (refreshStats) setStats(batch.stats);
    setIndex(0);
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) {
      console.debug("[TrueKana study queue] skipped duplicate initial effect");
      return;
    }
    initialLoadRef.current = true;
    const saved = window.localStorage.getItem("truekana-dark-mode");
    if (saved !== null) queueMicrotask(() => setDarkMode(saved === "true"));
    queueMicrotask(() => {
      fetchBatch()
        .then(applyBatch)
        .catch(errorValue =>
          setError(
            errorValue instanceof Error
              ? errorValue.message
              : "Could not load this study set."
          )
        )
        .finally(() => setLoading(false));
    });
  }, [applyBatch, fetchBatch]);

  const card = cards[index];
  const remaining = Math.max(cards.length - index, 0);
  const progress = stats.totalCards
    ? (stats.seenCards / stats.totalCards) * 100
    : 0;
  const sessionAccuracy = seenCount
    ? Math.round((correctCount / seenCount) * 100)
    : 0;
  const overallAccuracy = stats.totalCards
    ? Math.round((stats.correctCards / stats.totalCards) * 100)
    : 0;

  useEffect(() => {
    console.debug("[TrueKana study queue] active card", {
      cardId: card?.id ?? null,
      index,
      cardCount: cards.length,
      remaining
    });
  }, [card?.id, cards.length, index, remaining]);

  useEffect(() => {
    if (remaining <= 3 && cards.length > 0 && !prefetchRef.current) {
      console.debug("[TrueKana study queue] prefetch start", {
        currentCardId: card?.id,
        remaining,
        cardIds: cards.map(item => item.id)
      });
      prefetchRef.current = fetchBatch(cards.map(item => item.id)).catch(
        errorValue => {
          prefetchRef.current = null;
          throw errorValue;
        }
      );
      void prefetchRef.current.then(batch => {
        console.debug("[TrueKana study queue] prefetch ready", {
          cardIds: batch.cards.map(item => item.id)
        });
      });
    }
  }, [card?.id, cards, fetchBatch, remaining]);

  async function review(correct: boolean) {
    if (!card) return;
    console.debug("[TrueKana study queue] review requested", {
      cardId: card.id,
      correct,
      index
    });
    setSeenCount(current => current + 1);
    if (correct) setCorrectCount(current => current + 1);
    setStats(current => ({
      ...current,
      seenCards: current.seenCards + (card.seen ? 0 : 1),
      correctCards:
        current.correctCards +
        (correct && (!card.seen || card.progressStatus !== 1) ? 1 : 0) -
        (!correct && card.seen && card.progressStatus === 1 ? 1 : 0)
    }));
    void studyFetch(`/api/study-sets/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, correct })
    })
      .then(response => {
        if (!response.ok) setError("Could not save your progress.");
      })
      .catch(() => setError("Could not save your progress."));
  }

  async function nextCard() {
    console.debug("[TrueKana study queue] next card", {
      currentCardId: card?.id,
      index,
      cardCount: cards.length,
      hasPrefetch: Boolean(prefetchRef.current)
    });
    if (index + 1 < cards.length) {
      setIndex(current => current + 1);
      return;
    }
    setLoading(true);
    try {
      const batch = prefetchRef.current
        ? await prefetchRef.current
        : await fetchBatch(cards.map(item => item.id));
      prefetchRef.current = null;
      applyBatch(batch, false);
    } catch (errorValue) {
      setError(
        errorValue instanceof Error
          ? errorValue.message
          : "Could not refresh your queue."
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleDarkMode() {
    setDarkMode(current => {
      const next = !current;
      window.localStorage.setItem("truekana-dark-mode", String(next));
      return next;
    });
  }

  return (
    <main className={`app-shell ${darkMode ? "dark-mode" : ""}`}>
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">
            字
          </span>
          <span>TrueKana</span>
        </Link>
        <div className="topbar-actions">
          <Link
            className="text-button header-link"
            href={`/study-sets/${id}/settings`}
          >
            <span aria-hidden="true">⚙</span> Settings
          </Link>
          <AccountControl />
          <button
            className="theme-toggle"
            onClick={toggleDarkMode}
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {darkMode ? "☼" : "☾"}
          </button>
        </div>
      </header>
      <section className="study-page">
        <div className="page-heading">
          <Link className="text-button header-link" href="/dashboard">
            <span aria-hidden="true">←</span> All study sets
          </Link>
        </div>
        <div className="study-stats">
          <div className="progress-copy">
            <strong>
              {stats.seenCards}/{stats.totalCards}
            </strong>
            <span>cards seen</span>
          </div>
          <div className="progress-copy">
            <strong>
              {sessionAccuracy}% ({correctCount}/{seenCount})
            </strong>
            <span>session accuracy</span>
          </div>
          <div className="progress-copy">
            <strong>
              {overallAccuracy}% ({stats.correctCards}/{stats.totalCards})
            </strong>
            <span>overall accuracy</span>
          </div>
        </div>
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        {loading && !card ? (
          <div className="empty-state">
            <div className="loader" />
            <p>Loading your queue...</p>
          </div>
        ) : error && !card ? (
          <p className="api-error" role="alert">
            {error}
          </p>
        ) : !card ? (
          <div className="empty-state">
            <div className="empty-symbol">✓</div>
            <h3>You are all caught up</h3>
            <p>There are no cards due in this study set right now.</p>
          </div>
        ) : (
          <KanjiCard
            key={card.id}
            card={card}
            levelColor="mint"
            cardIndex={seenCount + 1}
            autoSubmission={settings.autoSubmission}
            showDefinitionAfterCorrect={settings.showDefinitionAfterCorrect}
            onAnswer={review}
            onNext={() => void nextCard()}
          />
        )}
        {error && card && (
          <p className="api-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
