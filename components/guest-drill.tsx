"use client";

import { useEffect, useRef, useState } from "react";
import AccountControl from "@/components/account-control";
import KanjiCard from "@/components/kanji-card";
import type { KanjiCardData } from "@/components/kanji-card";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";

type Card = KanjiCardData & { level: Level; id: string };

type DeckFile = {
    cards: { question: string; answer: string[]; meaning: string }[];
};

const levels: Level[] = ["N5", "N4", "N3", "N2", "N1"];
const levelMeta: Record<
    Level,
    { label: string; detail: string; color: string }
> = {
    N5: { label: "N5", detail: "Beginner", color: "mint" },
    N4: { label: "N4", detail: "Elementary", color: "sky" },
    N3: { label: "N3", detail: "Intermediate", color: "yellow" },
    N2: { label: "N2", detail: "Upper intermediate", color: "coral" },
    N1: { label: "N1", detail: "Advanced", color: "plum" }
};

function shuffle<T>(items: T[]) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [
            shuffled[randomIndex],
            shuffled[index]
        ];
    }
    return shuffled;
}

export default function Home() {
    const [selectedLevels, setSelectedLevels] = useState<Level[]>(["N5"]);
    const [cards, setCards] = useState<Card[]>([]);
    const [drillCards, setDrillCards] = useState<Card[]>([]);
    const [reviewCards, setReviewCards] = useState<Card[]>([]);
    const [cardIndex, setCardIndex] = useState(0);
    const [mode, setMode] = useState<"drill" | "review">("drill");
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const storageReadyRef = useRef(false);

    useEffect(() => {
        queueMicrotask(() => {
            const savedDarkMode =
                window.localStorage.getItem("truekana-dark-mode");
            const savedReviewPile = window.localStorage.getItem(
                "truekana-review-pile"
            );
            if (savedDarkMode !== null) setDarkMode(savedDarkMode === "true");
            if (savedReviewPile) {
                try {
                    const parsedCards = JSON.parse(savedReviewPile) as Card[];
                    if (Array.isArray(parsedCards)) {
                        setReviewCards(
                            parsedCards.filter(
                                card =>
                                    card?.question && Array.isArray(card.answer)
                            )
                        );
                    }
                } catch {
                    window.localStorage.removeItem("truekana-review-pile");
                }
            }
            storageReadyRef.current = true;
        });
    }, []);

    useEffect(() => {
        if (!storageReadyRef.current) return;
        window.localStorage.setItem("truekana-dark-mode", String(darkMode));
        window.localStorage.setItem(
            "truekana-review-pile",
            JSON.stringify(reviewCards)
        );
    }, [darkMode, reviewCards]);

    useEffect(() => {
        let active = true;
        Promise.all(
            levels.map(async level => {
                const response = await fetch(
                    `/resource/jlpt/${level.toLowerCase()}.json`
                );
                const data = (await response.json()) as DeckFile;
                return data.cards.map((card, index) => ({
                    ...card,
                    id: `${level.toLowerCase()}_${String(index + 1).padStart(4, "0")}`,
                    level
                }));
            })
        ).then(deckLists => {
            if (active) {
                const loadedCards = deckLists.flat();
                setCards(loadedCards);
                setDrillCards(
                    shuffle(loadedCards.filter(card => card.level === "N5"))
                );
                setLoading(false);
            }
        });
        return () => {
            active = false;
        };
    }, []);

    const activeCards = mode === "review" ? reviewCards : drillCards;
    const currentCard = activeCards[cardIndex];
    const answeredCount = Math.min(cardIndex, activeCards.length);
    const progress = activeCards.length
        ? (answeredCount / activeCards.length) * 100
        : 0;

    function toggleLevel(level: Level) {
        const nextLevels = selectedLevels.includes(level)
            ? selectedLevels.length === 1
                ? selectedLevels
                : selectedLevels.filter(item => item !== level)
            : [...selectedLevels, level];
        setSelectedLevels(nextLevels);
        setMode("drill");
        setDrillCards(
            shuffle(cards.filter(card => nextLevels.includes(card.level)))
        );
        setCardIndex(0);
    }

    function startReview() {
        setMode("review");
        setReviewCards(current => shuffle(current));
        setCardIndex(0);
    }

    function toggleDarkMode() {
        setDarkMode(current => {
            const nextMode = !current;
            window.localStorage.setItem("truekana-dark-mode", String(nextMode));
            return nextMode;
        });
    }

    function giveUp() {
        if (!currentCard) return;
        setReviewCards(current =>
            current.some(card => card.question === currentCard.question)
                ? current
                : [...current, currentCard]
        );
    }

    function nextCard() {
        setCardIndex(index => (index + 1) % Math.max(activeCards.length, 1));
    }

    return (
        <main className={`app-shell ${darkMode ? "dark-mode" : ""}`}>
            <header className="topbar">
                <div className="brand">
                    <span className="brand-mark" aria-hidden="true">字</span>
                    <span>TrueKana</span>
                </div>
                <div className="topbar-actions">
                    <div className="topbar-meta">
                        <span className="status-dot" />{" "}
                        <span>JLPT reading drills</span>
                    </div>
                    <AccountControl />
                    <button
                        className="theme-toggle"
                        onClick={toggleDarkMode}
                        aria-label={
                            darkMode
                                ? "Switch to light mode"
                                : "Switch to dark mode"
                        }
                    >
                        {darkMode ? "☼" : "☾"}
                    </button>
                </div>
            </header>

            <div className="workspace">
                <aside className="sidebar">
                    <div className="sidebar-intro">
                        <p className="eyebrow">Your study desk</p>
                        <h1>
                            Kanji, one
                            <br />
                            card at a time.
                        </h1>
                        <p className="muted">
                            Type the reading in romaji. TrueKana converts it as
                            you go.
                        </p>
                    </div>
                    <div className="level-heading">
                        <span>Choose your decks</span>
                        <span className="count-pill">
                            {selectedLevels.length}/5
                        </span>
                    </div>
                    <div className="level-list">
                        {levels.map(level => {
                            const meta = levelMeta[level];
                            const selected = selectedLevels.includes(level);
                            return (
                                <button
                                    key={level}
                                    className={`level-row ${selected ? "selected" : ""}`}
                                    onClick={() => toggleLevel(level)}
                                >
                                    <span
                                        className={`level-icon ${meta.color}`}
                                    >
                                        {level}
                                    </span>
                                    <span className="level-copy">
                                        <strong>{meta.detail}</strong>
                                        <small>{meta.label} deck</small>
                                    </span>
                                    <span className="checkmark">
                                        {selected ? "✓" : ""}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <button
                        className={`review-link ${mode === "review" ? "active" : ""}`}
                        onClick={startReview}
                        disabled={!reviewCards.length}
                    >
                        <span className="review-icon">↺</span>
                        <span>Review pile</span>
                        <span className="review-count">
                            {reviewCards.length}
                        </span>
                    </button>
                    <div className="sidebar-foot">
                        <span className="kbd">Enter</span>
                        <span>reveal / next card</span>
                    </div>
                </aside>

                <section className="drill-area">
                    <div className="drill-header">
                        <div>
                            <p className="eyebrow">
                                {mode === "review"
                                    ? "Focused review"
                                    : "JLPT deck"}
                            </p>
                            <h2>
                                {mode === "review"
                                    ? "Cards to revisit"
                                    : selectedLevels.join(" + ") +
                                      " reading practice"}
                            </h2>
                        </div>
                        <div className="progress-copy">
                            <strong>
                                {activeCards.length
                                    ? `${answeredCount + 1} / ${activeCards.length}`
                                    : "0 / 0"}
                            </strong>
                            <span>cards in session</span>
                        </div>
                    </div>
                    <div className="progress-track">
                        <span style={{ width: `${progress}%` }} />
                    </div>
                    {loading ? (
                        <div className="empty-state">
                            <div className="loader" />
                            <p>Loading your decks...</p>
                        </div>
                    ) : !currentCard ? (
                        <div className="empty-state">
                            <div className="empty-symbol">◎</div>
                            <h3>Your review pile is clear</h3>
                            <p>
                                Missed cards will appear here when you give up.
                            </p>
                            <button
                                className="primary-button"
                                onClick={() => setMode("drill")}
                            >
                                Back to drills
                            </button>
                        </div>
                    ) : (
                        <KanjiCard
                            key={currentCard.id}
                            card={currentCard}
                            levelColor={levelMeta[currentCard.level].color}
                            cardIndex={cardIndex}
                            onAnswer={correct => {
                                if (!correct) giveUp();
                            }}
                            onNext={nextCard}
                        />
                    )}
                    {currentCard && (
                        <div className="session-note">
                            <span className="note-mark">i</span>
                            <span>
                                Answers accept hiragana or romaji. Alternate
                                readings count too.
                            </span>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
