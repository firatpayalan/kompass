import { useCallback, useEffect, useState } from "react";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { WeeklySummary } from "../db/weeklySummariesRepo";
import { formatError } from "../lib/formatError";
import {
  defaultLlmBridge,
  type LlmBridge,
} from "../lib/llmBridge";
import {
  formatWeekLabel,
  getWeekRange,
  rangeFromWeekStart,
  shiftWeek,
} from "../lib/weekRange";
import {
  buildLlmNotesPayload,
  groupNotesForWeek,
  type WeekDigest,
} from "../lib/weeklyDigest";
import type { Initiative, Note, Person } from "../lib/types";
import NoteBodyView from "../components/NoteBodyView";

type HaftaDb = Pick<
  AppDb,
  | "listNotesInRange"
  | "listPeople"
  | "listInitiatives"
  | "getWeeklySummary"
  | "upsertWeeklySummary"
  | "getNoteImage"
>;

type HaftaViewProps = {
  db?: HaftaDb;
  llm?: LlmBridge;
  onToast?: (message: string) => void;
  onOpenPerson?: (person: Person) => void;
  onOpenInitiative?: (initiative: Initiative) => void;
  onGoAyarlar?: () => void;
};

const ignoreToast = () => undefined;
const ignoreOpen = () => undefined;

export default function HaftaView({
  db: dbProp,
  llm = defaultLlmBridge,
  onToast = ignoreToast,
  onOpenPerson = ignoreOpen,
  onOpenInitiative = ignoreOpen,
  onGoAyarlar,
}: HaftaViewProps) {
  const db = dbProp ?? getDb();
  const [weekStart, setWeekStart] = useState(
    () => getWeekRange(new Date()).weekStart,
  );
  const [digest, setDigest] = useState<WeekDigest | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [canSummarize, setCanSummarize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = rangeFromWeekStart(weekStart);
      const [rangeNotes, peopleRows, initiativeRows, cached, hasClaude, hasOpenai, settings] =
        await Promise.all([
          db.listNotesInRange(range.startIso, range.endIso),
          db.listPeople(),
          db.listInitiatives(),
          db.getWeeklySummary(weekStart),
          llm.hasClaudeApiKey(),
          llm.hasOpenaiApiKey(),
          llm.getLlmSettings(),
        ]);
      setNotes(rangeNotes);
      setPeople(peopleRows);
      setInitiatives(initiativeRows);
      setDigest(groupNotesForWeek(rangeNotes, peopleRows, initiativeRows));
      setSummary(cached);
      const providerHasKey =
        settings.provider === "claude" ? hasClaude : hasOpenai;
      setCanSummarize(providerHasKey);
    } catch {
      onToast("Hafta yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, llm, onToast, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSummarize = async () => {
    setBusy(true);
    setSummarizeError(null);
    try {
      const peopleById = new Map(people.map((p) => [p.id, p]));
      const initiativesById = new Map(initiatives.map((i) => [i.id, i]));
      const payload = buildLlmNotesPayload(notes, peopleById, initiativesById);
      const result = await llm.summarizeWeek({
        weekStart,
        notes: payload,
      });
      const createdAt = new Date().toISOString();
      await db.upsertWeeklySummary({
        weekStart,
        content: result.content,
        provider: result.provider,
        model: result.model,
        createdAt,
      });
      setSummary({
        weekStart,
        content: result.content,
        provider: result.provider,
        model: result.model,
        createdAt,
      });
      onToast("Özet kaydedildi");
    } catch (error) {
      const message = formatError(error, "Özetleme başarısız");
      setSummarizeError(message);
      onToast(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hafta-view">
      <h1>Hafta</h1>
      <div className="hafta-view__nav">
        <button
          aria-label="Önceki hafta"
          onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
          type="button"
        >
          ◀
        </button>
        <p>{formatWeekLabel(weekStart)}</p>
        <button
          aria-label="Sonraki hafta"
          onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
          type="button"
        >
          ▶
        </button>
      </div>

      {loading || !digest ? (
        <p>Yükleniyor…</p>
      ) : (
        <>
          <p className="hafta-view__counts">
            {digest.noteCount} not · {digest.personCount} kişi ·{" "}
            {digest.initiativeCount} iş
          </p>

          {summary ? (
            <section aria-labelledby="hafta-ozet-heading" className="hafta-view__ozet">
              <h2 id="hafta-ozet-heading">Özet</h2>
              <p className="hafta-view__ozet-meta">
                {summary.provider} · {summary.model}
              </p>
              <pre>{summary.content}</pre>
            </section>
          ) : null}

          {canSummarize ? (
            <button disabled={busy} onClick={() => void onSummarize()} type="button">
              {busy ? "Özetleniyor…" : "Özetle"}
            </button>
          ) : (
            <p>
              Özet için Ayarlar’dan API anahtarı ekleyin
              {onGoAyarlar ? (
                <>
                  {" "}
                  <button onClick={onGoAyarlar} type="button">
                    Ayarlar
                  </button>
                </>
              ) : null}
              .
            </p>
          )}
          {summarizeError ? (
            <p className="form-error" role="alert">
              {summarizeError}
            </p>
          ) : null}
          <p className="hafta-view__privacy">
            Özetle, not metinlerini seçilen sağlayıcıya gönderir.
          </p>

          <section aria-labelledby="hafta-kisiler-heading">
            <h2 id="hafta-kisiler-heading">Kişiler</h2>
            {digest.peopleSections.length === 0 ? (
              <p>Bu hafta kişi notu yok.</p>
            ) : (
              digest.peopleSections.map(({ entity, notes: sectionNotes }) => (
                <div key={entity.id} className="hafta-view__section">
                  <button
                    className="hafta-view__entity"
                    onClick={() => onOpenPerson(entity)}
                    type="button"
                  >
                    {entity.name}
                  </button>
                  <ul className="recent-note-list">
                    {sectionNotes.map((note) => (
                      <li key={note.id}>
                        <NoteBodyView
                          body={note.body}
                          getNoteImage={(id) => db.getNoteImage(id)}
                        />
                        <time dateTime={note.createdAt}>
                          {new Date(note.createdAt).toLocaleString("tr-TR")}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="hafta-isler-heading">
            <h2 id="hafta-isler-heading">İşler</h2>
            {digest.initiativeSections.length === 0 ? (
              <p>Bu hafta iş notu yok.</p>
            ) : (
              digest.initiativeSections.map(({ entity, notes: sectionNotes }) => (
                <div key={entity.id} className="hafta-view__section">
                  <button
                    className="hafta-view__entity"
                    onClick={() => onOpenInitiative(entity)}
                    type="button"
                  >
                    {entity.name}
                  </button>
                  <ul className="recent-note-list">
                    {sectionNotes.map((note) => (
                      <li key={note.id}>
                        <NoteBodyView
                          body={note.body}
                          getNoteImage={(id) => db.getNoteImage(id)}
                        />
                        <time dateTime={note.createdAt}>
                          {new Date(note.createdAt).toLocaleString("tr-TR")}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </section>
  );
}
