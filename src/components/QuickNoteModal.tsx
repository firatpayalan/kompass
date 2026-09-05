import { useEffect, useState } from "react";
import type { AppDb } from "../db/appDb";
import type { DraftStore } from "../lib/drafts";
import type { ReminderPeriod } from "../lib/types";
import ReminderForm from "./ReminderForm";

type QuickNoteDb = Pick<AppDb, "createNote" | "createReminder">;

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
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [period, setPeriod] = useState<ReminderPeriod>("once");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
      // Inbox capture: no person/initiative links — organize later in Gelen.
      note = await db.createNote({ body, personIds: [], initiativeIds: [] });
    } catch {
      draftStore.saveDraft(body);
      onToast("Kayıt başarısız; taslak korundu");
      setSaving(false);
      return;
    }

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
    } else {
      onToast("Gelen kutusuna kaydedildi");
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
        <p className="quick-note-modal__hint">
          Doğrudan Gelen’e kaydedilir. Toplantıdan sonra kişi veya işe taşıyın.
        </p>
        <label>
          Not
          <textarea
            autoFocus
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (saving) return;
                void save();
              }
            }}
            placeholder="Notunuzu yazın…"
            rows={7}
            value={body}
          />
        </label>

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
