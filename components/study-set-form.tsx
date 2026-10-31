"use client";

import { FormEvent, useMemo, useState } from "react";

export type Deck = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export type StudySettings = {
  reviewMode: "srs" | "simple";
  correctBehavior: "never" | "next_session" | "next_day" | "constant";
  wrongBehavior: "never" | "next_session" | "next_day" | "constant";
  correctDelayMinutes: number;
  wrongDelayMinutes: number;
  autoSubmission: boolean;
  showDefinitionAfterCorrect: boolean;
  wrongRetryMinutes: number;
  shuffle: boolean;
  collectRandomly: boolean;
};

const defaults: StudySettings = {
  reviewMode: "srs",
  correctBehavior: "never",
  wrongBehavior: "next_session",
  correctDelayMinutes: 10,
  wrongDelayMinutes: 10,
  autoSubmission: true,
  showDefinitionAfterCorrect: false,
  wrongRetryMinutes: 10,
  shuffle: true,
  collectRandomly: true
};

type Props = {
  decks: Deck[];
  initialName?: string;
  initialDeckIds?: string[];
  initialSettings?: Partial<StudySettings>;
  submitLabel: string;
  onSubmit: (data: {
    name: string;
    deckIds: string[];
    settings: StudySettings;
  }) => Promise<void>;
};

export default function StudySetForm({
  decks,
  initialName = "",
  initialDeckIds = [],
  initialSettings,
  submitLabel,
  onSubmit
}: Props) {
  const [name, setName] = useState(initialName);
  const [selected, setSelected] = useState<string[]>(initialDeckIds);
  const [settings, setSettings] = useState({
    ...defaults,
    ...initialSettings
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const behaviorLabels = {
    never: "Don't appear again",
    next_session: "Appear in next session",
    next_day: "Appear next day",
    constant: "Appear after a set time"
  } as const;
  const groups = useMemo(() => {
    return decks.reduce<Record<string, Deck[]>>((result, deck) => {
      (result[deck.category] ??= []).push(deck);
      return result;
    }, {});
  }, [decks]);

  function toggleDeck(id: string) {
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  }

  function toggleGroup(group: Deck[]) {
    const ids = group.map(deck => deck.id);
    const allSelected = ids.every(id => selected.includes(id));
    setSelected(current =>
      allSelected
        ? current.filter(id => !ids.includes(id))
        : [...new Set([...current, ...ids])]
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || selected.length === 0) {
      setError("Enter a name and select at least one deck.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ name: name.trim(), deckIds: selected, settings });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save this study set."
      );
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      <label htmlFor="study-set-name">Study set name</label>
      <input
        id="study-set-name"
        value={name}
        onChange={event => setName(event.target.value)}
        placeholder="My kanji study set"
        maxLength={100}
      />
      <div className="form-section-heading">
        <div>
          <p className="eyebrow">Card sources</p>
          <h2>Choose your decks</h2>
        </div>
        <span className="count-pill">{selected.length} selected</span>
      </div>
      <div className="deck-groups">
        {Object.entries(groups).map(([category, group]) => {
          const allSelected = group.every(deck => selected.includes(deck.id));
          return (
            <section className="deck-group" key={category}>
              <div className="deck-group-heading">
                <h3>{category}</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => toggleGroup(group)}
                >
                  {allSelected ? "Clear all" : "Select all"}
                </button>
              </div>
              {group.map(deck => (
                <label
                  className={`deck-option ${selected.includes(deck.id) ? "selected" : ""}`}
                  key={deck.id}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(deck.id)}
                    onChange={() => toggleDeck(deck.id)}
                  />
                  <span className="deck-option-copy">
                    <strong>{deck.name}</strong>
                    <small>{deck.description ?? "Practice deck"}</small>
                  </span>
                  <span className="checkmark">
                    {selected.includes(deck.id) ? "✓" : ""}
                  </span>
                </label>
              ))}
            </section>
          );
        })}
      </div>
      <div className="form-section-heading">
        <div>
          <p className="eyebrow">Study behavior</p>
          <h2>Personalize this set</h2>
        </div>
      </div>
      <div className="mode-choice">
        <label className={settings.reviewMode === "srs" ? "selected" : ""}>
          <input
            type="radio"
            name="review-mode"
            checked={settings.reviewMode === "srs"}
            onChange={() =>
              setSettings(current => ({
                ...current,
                reviewMode: "srs"
              }))
            }
          />
          <span>
            <strong>Simple SRS</strong>
            <small>Intervals grow automatically as you answer correctly.</small>
          </span>
        </label>
        <label className={settings.reviewMode === "simple" ? "selected" : ""}>
          <input
            type="radio"
            name="review-mode"
            checked={settings.reviewMode === "simple"}
            onChange={() =>
              setSettings(current => ({
                ...current,
                reviewMode: "simple"
              }))
            }
          />
          <span>
            <strong>Fixed behavior</strong>
            <small>Choose exactly when correct and wrong cards return.</small>
          </span>
        </label>
      </div>
      <label className="setting-option">
        <input
          type="checkbox"
          checked={settings.collectRandomly}
          onChange={event =>
            setSettings(current => ({
              ...current,
              collectRandomly: event.target.checked
            }))
          }
        />
        <span>
          <strong>Collect cards randomly</strong>
          <small>Choose new cards randomly from all selected decks.</small>
        </span>
      </label>
      {settings.reviewMode === "simple" && (
        <div className="fixed-behavior-grid">
          {(["correct", "wrong"] as const).map(result => {
            const key = `${result}Behavior` as
              "correctBehavior" | "wrongBehavior";
            const delayKey = `${result}DelayMinutes` as
              "correctDelayMinutes" | "wrongDelayMinutes";
            return (
              <div className="behavior-panel" key={result}>
                <h3>After a {result} answer</h3>
                <select
                  value={settings[key]}
                  onChange={event =>
                    setSettings(current => ({
                      ...current,
                      [key]: event.target.value as StudySettings[typeof key]
                    }))
                  }
                >
                  {Object.entries(behaviorLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {settings[key] === "constant" && (
                  <label>
                    Minutes
                    <input
                      type="number"
                      min={1}
                      max={10080}
                      value={settings[delayKey]}
                      onChange={event =>
                        setSettings(current => ({
                          ...current,
                          [delayKey]: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
      {settings.reviewMode === "srs" && (
        <label className="setting-field">
          Wrong answer retry (minutes)
          <input
            type="number"
            min={1}
            max={1440}
            value={settings.wrongRetryMinutes}
            onChange={event =>
              setSettings(current => ({
                ...current,
                wrongRetryMinutes: Number(event.target.value)
              }))
            }
          />
        </label>
      )}
      {error && (
        <p className="api-error" role="alert">
          {error}
        </p>
      )}
      <label className="setting-option">
        <input
          type="checkbox"
          checked={settings.autoSubmission}
          onChange={event =>
            setSettings(current => ({
              ...current,
              autoSubmission: event.target.checked
            }))
          }
        />
        <span>
          <strong>Auto-submit correct answers</strong>
          <small>Move on as soon as a matching reading is typed.</small>
        </span>
      </label>
      <label className="setting-option">
        <input
          type="checkbox"
          checked={settings.showDefinitionAfterCorrect}
          onChange={event =>
            setSettings(current => ({
              ...current,
              showDefinitionAfterCorrect: event.target.checked
            }))
          }
        />
        <span>
          <strong>Show definition after a correct answer</strong>
          <small>Keep the answer visible before moving to the next card.</small>
        </span>
      </label>
      <button className="primary-button form-submit" disabled={saving}>
        {saving ? "Saving..." : submitLabel} <span>→</span>
      </button>
    </form>
  );
}
