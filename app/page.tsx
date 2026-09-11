"use client";

import { useEffect, useRef, useState } from "react";

type Level = "N1" | "N2" | "N3" | "N4" | "N5";

type Card = {
  question: string;
  answer: string[];
  meaning: string;
  level: Level;
};

type DeckFile = {
  cards: { question: string; answer: string[]; meaning: string }[];
};

const levels: Level[] = ["N5", "N4", "N3", "N2", "N1"];
const levelMeta: Record<Level, { label: string; detail: string; color: string }> = {
  N5: { label: "N5", detail: "Beginner", color: "mint" },
  N4: { label: "N4", detail: "Elementary", color: "sky" },
  N3: { label: "N3", detail: "Intermediate", color: "yellow" },
  N2: { label: "N2", detail: "Upper intermediate", color: "coral" },
  N1: { label: "N1", detail: "Advanced", color: "plum" },
};

const romajiMap: Record<string, string> = {
  kya: "きゃ", kyu: "きゅ", kyo: "きょ", sha: "しゃ", shu: "しゅ", sho: "しょ",
  cha: "ちゃ", chu: "ちゅ", cho: "ちょ", nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ", mya: "みゃ", myu: "みゅ", myo: "みょ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ", gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ", pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
  ja: "じゃ", ju: "じゅ", jo: "じょ", fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
  wi: "うぃ", we: "うぇ", va: "ゔぁ", vi: "ゔぃ", vu: "ゔ", ve: "ゔぇ", vo: "ゔぉ",
  tsu: "つ", shi: "し", chi: "ち", fu: "ふ", ji: "じ", ye: "いぇ",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ", ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  sa: "さ", su: "す", se: "せ", so: "そ", za: "ざ", zu: "ず", ze: "ぜ", zo: "ぞ",
  ta: "た", te: "て", to: "と", da: "だ", de: "で", do: "ど", na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", he: "へ", ho: "ほ", ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ", ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ", ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ", wa: "わ", wo: "を",
  a: "あ", i: "い", u: "う", e: "え", o: "お", nn: "ん",
  ti: "ち", tu: "つ", si: "し", zi: "じ", du: "づ",
  tya: "ちゃ", tyu: "ちゅ", tyo: "ちょ", sya: "しゃ", syu: "しゅ", syo: "しょ",
};

function toKana(value: string) {
  let result = "";
  let index = 0;
  const lower = value.toLowerCase();
  while (index < lower.length) {
    if (index + 1 < lower.length && lower[index] === lower[index + 1] && /[bcdfghjklmpqrstvwxyz]/.test(lower[index])) {
      result += "っ";
      index += 1;
      continue;
    }
    let matched = false;
    for (const length of [3, 2, 1]) {
      const part = lower.slice(index, index + length);
      if (romajiMap[part]) {
        result += romajiMap[part];
        index += length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += lower[index];
      index += 1;
    }
  }
  return result;
}

function normalize(value: string) {
  return toKana(value).replace(/[ー\s]/g, "").trim();
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

export default function Home() {
  const [selectedLevels, setSelectedLevels] = useState<Level[]>(["N5"]);
  const [cards, setCards] = useState<Card[]>([]);
  const [drillCards, setDrillCards] = useState<Card[]>([]);
  const [reviewCards, setReviewCards] = useState<Card[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"drill" | "review">("drill");
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "correct">("idle");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawInputRef = useRef("");

  useEffect(() => {
    let active = true;
    Promise.all(levels.map(async (level) => {
      const response = await fetch(`/resource/jlpt/${level.toLowerCase()}.json`);
      const data = (await response.json()) as DeckFile;
      return data.cards.map((card) => ({ ...card, level }));
    })).then((deckLists) => {
      if (active) {
        const loadedCards = deckLists.flat();
        setCards(loadedCards);
        setDrillCards(shuffle(loadedCards.filter((card) => card.level === "N5")));
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const activeCards = mode === "review" ? reviewCards : drillCards;
  const currentCard = activeCards[cardIndex];
  const answeredCount = Math.min(cardIndex, activeCards.length);
  const progress = activeCards.length ? ((answeredCount / activeCards.length) * 100) : 0;

  useEffect(() => { inputRef.current?.focus(); }, [cardIndex, mode, loading]);

  useEffect(() => {
    if (!revealed) return;
    function handleRevealedKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.defaultPrevented) return;
      event.preventDefault();
      setCardIndex((index) => (index + 1) % Math.max(activeCards.length, 1));
      setInput("");
      rawInputRef.current = "";
      setRevealed(false);
      setFeedback("idle");
    }
    window.addEventListener("keydown", handleRevealedKeyDown);
    return () => window.removeEventListener("keydown", handleRevealedKeyDown);
  }, [activeCards.length, revealed]);

  function toggleLevel(level: Level) {
    const nextLevels = selectedLevels.includes(level)
      ? (selectedLevels.length === 1 ? selectedLevels : selectedLevels.filter((item) => item !== level))
      : [...selectedLevels, level];
    setSelectedLevels(nextLevels);
    setMode("drill");
    setDrillCards(shuffle(cards.filter((card) => nextLevels.includes(card.level))));
    setCardIndex(0);
    setInput("");
    rawInputRef.current = "";
    setRevealed(false);
    setFeedback("idle");
  }

  function startReview() {
    setMode("review");
    setReviewCards((current) => shuffle(current));
    setCardIndex(0);
    setInput("");
    rawInputRef.current = "";
    setRevealed(false);
    setFeedback("idle");
  }

  function checkAnswer(nextKana: string) {
    if (!currentCard || revealed || !nextKana) return;
    if (currentCard.answer.some((answer) => normalize(answer) === normalize(nextKana))) {
      setFeedback("correct");
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        setCardIndex((index) => (index + 1) % activeCards.length);
        setInput("");
        rawInputRef.current = "";
        setFeedback("idle");
      }, 120);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (revealed) nextCard();
      else giveUp();
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      let nextRaw = rawInputRef.current.slice(0, -1);
      let nextKana = toKana(nextRaw);
      while (/[a-z]/i.test(nextKana) && nextRaw) {
        nextRaw = nextRaw.slice(0, -1);
        nextKana = toKana(nextRaw);
      }
      rawInputRef.current = nextRaw;
      setInput(nextKana);
      return;
    }
    if (event.key.length === 1 && /[a-z]/i.test(event.key)) {
      event.preventDefault();
      rawInputRef.current += event.key.toLowerCase();
      const nextKana = toKana(rawInputRef.current);
      setInput(nextKana);
      checkAnswer(nextKana);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    rawInputRef.current += event.clipboardData.getData("text");
    const nextKana = toKana(rawInputRef.current);
    setInput(nextKana);
    checkAnswer(nextKana);
  }

  function giveUp() {
    if (!currentCard || revealed) return;
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setFeedback("idle");
    setReviewCards((current) => current.some((card) => card.question === currentCard.question)
      ? current
      : [...current, currentCard]);
    setRevealed(true);
  }

  function nextCard() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setCardIndex((index) => (index + 1) % Math.max(activeCards.length, 1));
    setInput("");
    rawInputRef.current = "";
    setRevealed(false);
    setFeedback("idle");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">字</span><span>TrueKana</span></div>
        <div className="topbar-meta"><span className="status-dot" /> <span>JLPT reading drills</span></div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-intro"><p className="eyebrow">Your study desk</p><h1>Kanji, one<br />card at a time.</h1><p className="muted">Type the reading in romaji. TrueKana converts it as you go.</p></div>
          <div className="level-heading"><span>Choose your decks</span><span className="count-pill">{selectedLevels.length}/5</span></div>
          <div className="level-list">
            {levels.map((level) => {
              const meta = levelMeta[level];
              const selected = selectedLevels.includes(level);
              return <button key={level} className={`level-row ${selected ? "selected" : ""}`} onClick={() => toggleLevel(level)}>
                <span className={`level-icon ${meta.color}`}>{level}</span><span className="level-copy"><strong>{meta.detail}</strong><small>{meta.label} deck</small></span><span className="checkmark">{selected ? "✓" : ""}</span>
              </button>;
            })}
          </div>
          <button className={`review-link ${mode === "review" ? "active" : ""}`} onClick={startReview} disabled={!reviewCards.length}><span className="review-icon">↺</span><span>Review pile</span><span className="review-count">{reviewCards.length}</span></button>
          <div className="sidebar-foot"><span className="kbd">Enter</span><span>reveal / next card</span></div>
        </aside>

        <section className="drill-area">
          <div className="drill-header"><div><p className="eyebrow">{mode === "review" ? "Focused review" : "JLPT deck"}</p><h2>{mode === "review" ? "Cards to revisit" : selectedLevels.join(" + ") + " reading practice"}</h2></div><div className="progress-copy"><strong>{activeCards.length ? `${answeredCount + 1} / ${activeCards.length}` : "0 / 0"}</strong><span>cards in session</span></div></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          {loading ? <div className="empty-state"><div className="loader" /><p>Loading your decks...</p></div> : !currentCard ? <div className="empty-state"><div className="empty-symbol">◎</div><h3>Your review pile is clear</h3><p>Missed cards will appear here when you give up.</p><button className="primary-button" onClick={() => setMode("drill")}>Back to drills</button></div> : <>
            <div className={`question-card ${feedback === "correct" ? "is-correct" : ""}`}>
              {feedback === "correct" && <div className="particle-field" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div>}
              <div className="card-topline"><span className={`deck-tag ${levelMeta[currentCard.level].color}`}>JLPT {currentCard.level}</span><span className="card-number">Card {String(cardIndex + 1).padStart(2, "0")}</span></div>
              <div className="kanji-wrap"><span className="kanji">{currentCard.question}</span><span className="spark">✦</span></div>
              <div className="answer-zone">
                {revealed ? <div className="revealed-answer"><span className="answer-label">Answer</span><strong>{currentCard.answer.join(" / ")}</strong><span>{currentCard.meaning}</span></div> : <><label htmlFor="reading">Reading</label><div className="input-wrap"><input ref={inputRef} id="reading" value={input} onChange={(event) => { setInput(event.target.value); rawInputRef.current = event.target.value; }} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder="type in romaji..." autoComplete="off" autoCapitalize="off" spellCheck={false} /><span className="kana-placeholder">{input ? "" : "あ"}</span></div><div className="input-hint"><span>Type romaji, edit the kana directly</span><span className="mini-kbd">↵ reveal / next</span></div></>}
              </div>
              {feedback === "correct" && <div className="feedback correct-feedback">Correct <span>moving on</span></div>}
              {revealed && <div className="revealed-footer"><span>Added to review pile</span><button onClick={nextCard}>Next card <span>→</span></button></div>}
            </div>
            <div className="session-note"><span className="note-mark">i</span><span>Answers accept hiragana or romaji. Alternate readings count too.</span></div>
          </>}
        </section>
      </div>
    </main>
  );
}
