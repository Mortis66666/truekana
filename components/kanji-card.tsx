"use client";

import { useEffect, useRef, useState } from "react";
import { romajiMap } from "./romajiMap";

export type KanjiCardData = {
    id?: string;
    question: string;
    answer: string[];
    meaning: string;
    level: string;
};

type KanjiCardProps = {
    card: KanjiCardData;
    levelColor: string;
    cardIndex: number;
    isRedemption?: boolean;
    autoSubmission?: boolean;
    showDefinitionAfterCorrect?: boolean;
    onAnswer?: (correct: boolean) => Promise<void> | void;
    onNext: () => void;
};

function toKana(value: string) {
    let result = "";
    let index = 0;
    const lower = value.toLowerCase();
    while (index < lower.length) {
        if (
            index + 1 < lower.length &&
            lower[index] === lower[index + 1] &&
            /[bcdfghjklmpqrstvwxyz]/.test(lower[index])
        ) {
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
    return toKana(value)
        .replace(/[ー\s]/g, "")
        .trim();
}

export default function KanjiCard({
    card,
    levelColor,
    cardIndex,
    isRedemption = false,
    autoSubmission = true,
    showDefinitionAfterCorrect = false,
    onAnswer,
    onNext
}: KanjiCardProps) {
    const [input, setInput] = useState("");
    const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");
    const [revealed, setRevealed] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const answeredRef = useRef(false);
    const userInputRef = useRef(false);

    useEffect(() => {
        inputRef.current?.focus();
    }, [card.id]);

    useEffect(() => {
        if (!revealed) return;
        function handleRevealedKeyDown(event: KeyboardEvent) {
            if (event.key !== "Enter" || event.defaultPrevented) return;
            event.preventDefault();
            onNext();
        }
        window.addEventListener("keydown", handleRevealedKeyDown);
        return () =>
            window.removeEventListener("keydown", handleRevealedKeyDown);
    }, [onNext, revealed]);

    async function answer(correct: boolean) {
        if (answeredRef.current) return;
        answeredRef.current = true;
        setFeedback(correct ? "correct" : "incorrect");
        onAnswer?.(correct);
        if (correct) {
            if (showDefinitionAfterCorrect) setRevealed(true);
            else onNext();
        } else {
            setRevealed(true);
        }
    }

    function submitAnswer() {
        const correct = card.answer.some(
            answerValue => normalize(answerValue) === normalize(input)
        );
        void answer(correct);
    }

    function updateInput(value: string) {
        if (answeredRef.current) return;
        if (!userInputRef.current) return;
        const kana = toKana(value);
        setInput(kana);
        if (
            kana.length > 0 &&
            userInputRef.current &&
            autoSubmission &&
            card.answer.some(
                answerValue => normalize(answerValue) === normalize(kana)
            )
        ) {
            void answer(true);
        }
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (answeredRef.current) {
            event.preventDefault();
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            if (revealed) onNext();
            else if (!autoSubmission) {
                submitAnswer();
            } else void answer(false);
            return;
        }
        if (event.key.length === 1) userInputRef.current = true;
        if (event.key === "Backspace") {
            event.preventDefault();
            userInputRef.current = true;
            updateInput(input.slice(0, -1));
        }
    }

    return (
        <div
            className={`question-card ${
                feedback === "correct"
                    ? "is-correct"
                    : feedback === "incorrect"
                        ? "is-incorrect"
                        : ""
            }`}
        >
            {feedback === "correct" && (
                <div className="particle-field" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, index) => (
                        <span key={index} />
                    ))}
                </div>
            )}
            <div className="card-topline">
                <div className="card-tags">
                    <span className={`deck-tag ${levelColor}`}>
                        JLPT {card.level}
                    </span>
                    {isRedemption && (
                        <span
                            className="redemption-tag"
                            title="You answered this card wrong last time"
                            aria-label="Redemption card: answered wrong last time"
                        >
                            <span aria-hidden="true">↺</span> Redemption
                        </span>
                    )}
                </div>
                <span className="card-number">
                    Card {String(cardIndex + 1).padStart(2, "0")}
                </span>
            </div>
            <div className="kanji-wrap">
                <span className="kanji">{card.question}</span>
                <span className="spark">✦</span>
            </div>
            <div className="answer-zone">
                {revealed ? (
                    <div className="revealed-answer">
                        <span className="answer-label">Answer</span>
                        <div className="reading-chips">
                            {card.answer.map(reading => (
                                <strong key={reading}>{reading}</strong>
                            ))}
                        </div>
                        <ul className="meaning-list">
                            {card.meaning.split(";").map(meaning => (
                                <li key={meaning}>{meaning.trim()}</li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <>
                        <label htmlFor="reading">Reading</label>
                        <div className="input-wrap">
                            <input
                                ref={inputRef}
                                id="reading"
                                value={input}
                                onChange={event =>
                                    updateInput(event.target.value)
                                }
                                onKeyDown={handleKeyDown}
                                onPaste={event => {
                                    event.preventDefault();
                                    updateInput(event.clipboardData.getData("text"));
                                }}
                                placeholder="type in romaji..."
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                            />
                            <span className="kana-placeholder">
                                {input ? "" : "あ"}
                            </span>
                        </div>
                        <div className="input-hint">
                            <span>Type romaji, edit the kana directly</span>
                            <span className="mini-kbd">
                                ↵ {autoSubmission ? "reveal / next" : "submit"}
                            </span>
                        </div>
                        <button
                            className="reveal-button"
                            onClick={() =>
                                autoSubmission ? void answer(false) : submitAnswer()
                            }
                        >
                            {autoSubmission ? "Reveal answer" : "Submit answer"}{" "}
                            <span>↵</span>
                        </button>
                    </>
                )}
            </div>
            {feedback !== "idle" && (
                <div
                    className={`feedback ${
                        feedback === "correct"
                            ? "correct-feedback"
                            : "incorrect-feedback"
                    }`}
                    role="status"
                >
                    {feedback === "correct" ? "Correct" : "Not quite"}
                    <span>
                        {feedback === "correct" ? "moving on" : "answer shown"}
                    </span>
                </div>
            )}
            {revealed && (
                <div className="revealed-footer">
                    <span>Added to review pile</span>
                    <button onClick={onNext}>
                        Next card <span>→</span>
                    </button>
                </div>
            )}
        </div>
    );
}
