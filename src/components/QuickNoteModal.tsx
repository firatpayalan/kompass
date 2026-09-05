import { useEffect, useState } from "react";
import type { AppDb } from "../db/appDb";
import type { DraftStore } from "../lib/drafts";
import type {
  Initiative,
  Person,
  ReminderPeriod,
} from "../lib/types";
import ReminderForm from "./ReminderForm";

type QuickNoteDb = Pick<
  AppDb,
  "createNote" | "createReminder" | "listPeople" | "listInitiatives"
>;

type QuickNoteModalProps = {
  db: QuickNoteDb;
  draftStore: DraftStore;
  onClose: () => void;
  onSaved: () => void;
  onToast: (message: string) => void;
};

export default function QuickNoteModal({
  db,
  draftStore,
  onClose,
  onSaved,
  onToast,
}: QuickNoteModalProps) {
  const [body, setBody] = useState(draftStore.getDraft() ?? "");
  const [people, setPeople] = useState<Person[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [personIds, setPersonIds] = useState<number[]>([]);
  const [initiativeIds, setInitiativeIds] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [period, setPeriod] = useState<ReminderPeriod>("once");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([db.listPeople(), db.listInitiatives()]).then(
      ([nextPeople, nextInitiatives]) => {
        setPeople(nextPeople);
        setInitiatives(nextInitiatives);
      },
      () => onToast("Seçenekler yüklenemedi"),
    );
  }, [db, onToast]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const toggleId = (
    id: number,
    selectedIds: number[],
    setSelectedIds: (ids: number[]) => void,
  ) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  };

  const save = async () => {
    if (!body.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    if (reminderEnabled && !dueAt) {
      onToast("Hatırlatma zamanı gerekli");
      return;
    }

    setSaving(true);
    let note;
    try {
      note = await db.createNote({ body, personIds, initiativeIds });
    } catch {
      draftStore.saveDraft(body);
      onToast("Kayıt başarısız; taslak korundu");
      setSaving(false);
      return;
    }

    // The note is already persisted, so a failed reminder must not resurrect
    // the body as a draft and invite a duplicate note.
    let reminderFailed = false;
    if (reminderEnabled) {
      try {
        await db.createReminder({
          targetType: "note",
          targetId: note.id,
          dueAt: new Date(dueAt).toISOString(),
          period,
          nowIso: new Date().toISOString(),
        });
      } catch {
        reminderFailed = true;
      }
    }

    draftStore.clearDraft();
    setSaving(false);
    if (reminderFailed) {
      onToast("Not kaydedildi, hatırlatma eklenemedi");
    }
    onSaved();
    onClose();
  };

  return (
    <div aria-modal="true" className="modal-backdrop" role="dialog">
      <section className="quick-note-modal">
        <header>
          <h2>Hızlı Not</h2>
          <button aria-label="Kapat" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <label>
          Not
          <textarea
            autoFocus
            onChange={(event) => setBody(event.target.value)}
            placeholder="Notunuzu yazın…"
            rows={7}
            value={body}
          />
        </label>

        <div className="quick-note-modal__links">
          <fieldset>
            <legend>Kişiler</legend>
            {people.length === 0 ? <span>Kişi yok</span> : null}
            {people.map((person) => (
              <label key={person.id}>
                <input
                  checked={personIds.includes(person.id)}
                  onChange={() => toggleId(person.id, personIds, setPersonIds)}
                  type="checkbox"
                />
                {person.name}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>İşler</legend>
            {initiatives.length === 0 ? <span>İş yok</span> : null}
            {initiatives.map((initiative) => (
              <label key={initiative.id}>
                <input
                  checked={initiativeIds.includes(initiative.id)}
                  onChange={() =>
                    toggleId(
                      initiative.id,
                      initiativeIds,
                      setInitiativeIds,
                    )
                  }
                  type="checkbox"
                />
                {initiative.name}
              </label>
            ))}
          </fieldset>
        </div>

        <ReminderForm
          dueAt={dueAt}
          enabled={reminderEnabled}
          onDueAtChange={setDueAt}
          onEnabledChange={setReminderEnabled}
          onPeriodChange={setPeriod}
          period={period}
        />
        <footer>
          <button onClick={onClose} type="button">
            Vazgeç
          </button>
          <button disabled={saving} onClick={save} type="button">
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </footer>
      </section>
    </div>
  );
}
