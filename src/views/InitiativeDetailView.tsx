import { useEffect, useState } from "react";
import LinkedNotes from "../components/LinkedNotes";
import ReminderForm from "../components/ReminderForm";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type {
  Initiative,
  InitiativeStatus,
  Note,
  ReminderPeriod,
} from "../lib/types";

type InitiativeDetailDb = Pick<
  AppDb,
  "createReminder" | "listNotesForInitiative" | "updateInitiative"
>;

type InitiativeDetailViewProps = {
  db?: InitiativeDetailDb;
  initiative: Initiative;
  onBack: () => void;
  onToast?: (message: string) => void;
};

const ignore = () => undefined;

const statusLabels: Record<InitiativeStatus, string> = {
  aktif: "Aktif",
  beklemede: "Beklemede",
  bitti: "Bitti",
};

export default function InitiativeDetailView({
  db = getDb(),
  initiative,
  onBack,
  onToast = ignore,
}: InitiativeDetailViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(initiative);
  const [status, setStatus] = useState<InitiativeStatus>(initiative.status);
  const [blockerSummary, setBlockerSummary] = useState(
    initiative.blockerSummary ?? "",
  );
  const [savingDetails, setSavingDetails] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [period, setPeriod] = useState<ReminderPeriod>("once");
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    setCurrent(initiative);
    setStatus(initiative.status);
    setBlockerSummary(initiative.blockerSummary ?? "");
  }, [initiative]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.listNotesForInitiative(initiative.id)
      .then((loaded) => {
        if (active) {
          setNotes(loaded);
        }
      })
      .catch(() => {
        if (active) {
          onToast("Bağlı notlar yüklenemedi");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [db, initiative.id, onToast]);

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      setCurrent(
        await db.updateInitiative(current.id, {
          status,
          blockerSummary: blockerSummary.trim() || null,
        }),
      );
      onToast("İş güncellendi");
    } catch {
      onToast("İş güncellenemedi");
    } finally {
      setSavingDetails(false);
    }
  };

  const saveReminder = async () => {
    if (!dueAt) {
      onToast("Hatırlatma zamanı gerekli");
      return;
    }

    setSavingReminder(true);
    try {
      await db.createReminder({
        targetType: "initiative",
        targetId: current.id,
        dueAt: new Date(dueAt).toISOString(),
        period,
        nowIso: new Date().toISOString(),
      });
      setReminderEnabled(false);
      setDueAt("");
      setPeriod("once");
      onToast("Hatırlatma eklendi");
    } catch {
      onToast("Hatırlatma eklenemedi");
    } finally {
      setSavingReminder(false);
    }
  };

  return (
    <section className="detail-view">
      <button className="back-button" onClick={onBack} type="button">
        ← İşlere dön
      </button>
      <div className="detail-view__heading">
        <h1>{current.name}</h1>
        <span className={`status status--${current.status}`}>
          {statusLabels[current.status]}
        </span>
      </div>
      <div className="entity-form">
        <label>
          Durum
          <select
            onChange={(event) =>
              setStatus(event.target.value as InitiativeStatus)
            }
            value={status}
          >
            <option value="aktif">Aktif</option>
            <option value="beklemede">Beklemede</option>
            <option value="bitti">Bitti</option>
          </select>
        </label>
        <label>
          Engel özeti
          <textarea
            onChange={(event) => setBlockerSummary(event.target.value)}
            rows={3}
            value={blockerSummary}
          />
        </label>
        <button disabled={savingDetails} onClick={saveDetails} type="button">
          {savingDetails ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </button>
      </div>
      <ReminderForm
        dueAt={dueAt}
        enabled={reminderEnabled}
        onDueAtChange={setDueAt}
        onEnabledChange={setReminderEnabled}
        onPeriodChange={setPeriod}
        period={period}
      />
      {reminderEnabled ? (
        <button disabled={savingReminder} onClick={saveReminder} type="button">
          {savingReminder ? "Ekleniyor…" : "Hatırlatmayı kaydet"}
        </button>
      ) : null}
      <h2>Bağlı notlar</h2>
      <LinkedNotes loading={loading} notes={notes} />
    </section>
  );
}
