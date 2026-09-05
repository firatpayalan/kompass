import { useEffect, useState } from "react";
import LinkedNotes from "../components/LinkedNotes";
import NoteBodyField from "../components/NoteBodyField";
import ReminderForm, {
  type ReminderDraft,
} from "../components/ReminderForm";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { PersonLabelColor } from "../lib/personLabels";
import type {
  Initiative,
  InitiativeStatus,
  Note,
  NoteTag,
  ReminderPeriod,
} from "../lib/types";

type InitiativeDetailDb = Pick<
  AppDb,
  | "createReminder"
  | "createNote"
  | "listNotesForInitiative"
  | "updateInitiative"
  | "updateNote"
  | "softDeleteNote"
  | "addTagToNote"
  | "linkTagToNote"
  | "listNoteTags"
  | "updateNoteTag"
  | "deleteNoteTag"
  | "saveNoteImage"
  | "getNoteImage"
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
  const [noteTagCatalog, setNoteTagCatalog] = useState<NoteTag[]>([]);
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
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setCurrent(initiative);
    setStatus(initiative.status);
    setBlockerSummary(initiative.blockerSummary ?? "");
  }, [initiative]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      db.listNotesForInitiative(initiative.id),
      db.listNoteTags(),
    ])
      .then(([loaded, catalog]) => {
        if (active) {
          setNotes(loaded);
          setNoteTagCatalog(catalog);
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

  const reloadNotes = async () => {
    try {
      const [loaded, catalog] = await Promise.all([
        db.listNotesForInitiative(initiative.id),
        db.listNoteTags(),
      ]);
      setNotes(loaded);
      setNoteTagCatalog(catalog);
    } catch {
      onToast("Bağlı notlar yüklenemedi");
    }
  };

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      const nextBlocker =
        status === "beklemede" ? blockerSummary.trim() || null : null;
      const previousBlocker = current.blockerSummary?.trim() || null;
      const updated = await db.updateInitiative(current.id, {
        status,
        blockerSummary: nextBlocker,
      });
      setCurrent(updated);

      if (nextBlocker && nextBlocker !== previousBlocker) {
        try {
          await db.createNote({
            body: nextBlocker,
            initiativeIds: [current.id],
            personIds: [],
          });
          await reloadNotes();
        } catch {
          onToast("İş güncellendi, engel notu eklenemedi");
          return;
        }
      }

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

  const addNote = async () => {
    if (!noteDraft.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    setSavingNote(true);
    try {
      await db.createNote({
        body: noteDraft,
        initiativeIds: [current.id],
        personIds: [],
      });
      setNoteDraft("");
      onToast("Not eklendi");
      await reloadNotes();
    } catch {
      onToast("Not eklenemedi");
    } finally {
      setSavingNote(false);
    }
  };

  const updateNote = async (
    noteId: number,
    body: string,
    reminder: ReminderDraft | null = null,
  ) => {
    if (!body.trim()) {
      onToast("Not boş olamaz");
      throw new Error("Not boş olamaz");
    }
    try {
      await db.updateNote(noteId, body);
    } catch {
      onToast("Not güncellenemedi");
      throw new Error("Not güncellenemedi");
    }

    let reminderFailed = false;
    if (reminder) {
      try {
        await db.createReminder({
          targetType: "note",
          targetId: noteId,
          dueAt: new Date(reminder.dueAt).toISOString(),
          period: reminder.period,
          nowIso: new Date().toISOString(),
        });
      } catch {
        reminderFailed = true;
      }
    }

    await reloadNotes();
    if (reminderFailed) {
      onToast("Not kaydedildi, hatırlatma eklenemedi");
    } else {
      onToast("Not güncellendi");
    }
  };

  const archiveNote = async (noteId: number) => {
    try {
      await db.softDeleteNote(noteId, new Date().toISOString());
      onToast("Not arşivlendi");
      await reloadNotes();
    } catch {
      onToast("Not arşivlenemedi");
    }
  };

  const noteTagHandlers = {
    tagCatalog: noteTagCatalog,
    onAddTag: async (
      noteId: number,
      name: string,
      color: PersonLabelColor,
    ) => {
      await db.addTagToNote(noteId, { name, color });
      await reloadNotes();
    },
    onLinkTag: async (noteId: number, tagId: number) => {
      await db.linkTagToNote(noteId, tagId);
      await reloadNotes();
    },
    onUpdateTag: async (
      id: number,
      patch: { name?: string; color?: PersonLabelColor },
    ) => {
      await db.updateNoteTag(id, patch);
      await reloadNotes();
    },
    onDeleteTag: async (id: number) => {
      await db.deleteNoteTag(id);
      await reloadNotes();
    },
    onToast,
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
        {status === "beklemede" ? (
          <label>
            Engel özeti
            <textarea
              onChange={(event) => setBlockerSummary(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (savingDetails) return;
                  void saveDetails();
                }
              }}
              rows={3}
              value={blockerSummary}
            />
          </label>
        ) : null}
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
      <LinkedNotes
        getNoteImage={(id) => db.getNoteImage(id)}
        loading={loading}
        notes={notes}
        onArchiveNote={archiveNote}
        onUpdateNote={updateNote}
        saveNoteImage={(input) => db.saveNoteImage(input)}
        {...noteTagHandlers}
      />
      <form
        className="topic-note-form"
        onSubmit={(event) => {
          event.preventDefault();
          void addNote();
        }}
      >
        <NoteBodyField
          label="Not ekle"
          onChange={setNoteDraft}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (savingNote) return;
              void addNote();
            }
          }}
          onToast={onToast}
          placeholder={`${current.name} hakkında not…`}
          rows={3}
          saveNoteImage={(input) => db.saveNoteImage(input)}
          value={noteDraft}
        />
        <button disabled={savingNote} type="submit">
          {savingNote ? "Kaydediliyor…" : "Not ekle"}
        </button>
      </form>
    </section>
  );
}
