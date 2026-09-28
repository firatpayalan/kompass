import { useEffect, useRef, useState } from "react";
import type { AppDb } from "../db/appDb";
import type { DraftStore } from "../lib/drafts";
import type { ReminderPeriod } from "../lib/types";
import ReminderForm from "./ReminderForm";
import NoteBodyField from "./NoteBodyField";

type QuickNoteDb = Pick<
  AppDb,
  "createNote" | "createReminder" | "saveNoteImage"
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
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [period, setPeriod] = useState<ReminderPeriod>("once");
  const [saving, setSaving] = useState(false);
  const discardedRef = useRef(false);

  useEffect(() => {
    if (body.trim()) {
      draftStore.saveDraft(body);
    }
  }, [body, draftStore]);

  const discard = () => {
    discardedRef.current = true;
    draftStore.clearDraft();
    onClose();
  };

  const save = async (options?: { requireReminderFields?: boolean }) => {
    const requireReminderFields = options?.requireReminderFields ?? true;
    if (!body.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    if (requireReminderFields && reminderEnabled && !dueAt) {
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
    if (reminderEnabled && dueAt) {
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

  const dismissWithSave = async () => {
    if (saving || discardedRef.current) return;
    if (!body.trim()) {
      draftStore.clearDraft();
      onClose();
      return;
    }
    await save({ requireReminderFields: false });
  };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      void dismissWithSave();
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
    // dismissWithSave closes over latest body/saving
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, saving, dueAt, reminderEnabled, period]);

  return (
    <div
      aria-modal="true"
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          void dismissWithSave();
        }
      }}
      role="dialog"
    >
      <section
        className="quick-note-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>Hızlı Not</h2>
          <button
            aria-label="Kapat"
            onClick={() => void dismissWithSave()}
            type="button"
          >
            ×
          </button>
        </header>
        <p className="quick-note-modal__hint">
          Doğrudan Gelen’e kaydedilir. Toplantıdan sonra kişi veya işe taşıyın.
          Vazgeç dışındaki kapatmalar notu kaydeder.
        </p>
        <NoteBodyField
          autoFocus
          label="Not"
          onChange={setBody}
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
          onToast={onToast}
          placeholder="Notunuzu yazın…"
          rows={7}
          saveNoteImage={(input) => db.saveNoteImage(input)}
          value={body}
        />

        <ReminderForm
          dueAt={dueAt}
          enabled={reminderEnabled}
          onDueAtChange={setDueAt}
          onEnabledChange={setReminderEnabled}
          onPeriodChange={setPeriod}
          period={period}
        />
        <footer>
          <button onClick={discard} type="button">
            Vazgeç
          </button>
          <button
            disabled={saving}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </footer>
      </section>
    </div>
  );
}
