import { useCallback, useEffect, useState } from "react";
import NoteList from "../components/NoteList";
import type { ReminderDraft } from "../components/ReminderForm";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Initiative, Note, NoteTag, Person } from "../lib/types";

type NotesDb = Pick<
  AppDb,
  | "createReminder"
  | "listActiveNotes"
  | "listPeople"
  | "listInitiatives"
  | "softDeleteNote"
  | "updateNote"
  | "addTagToNote"
  | "linkTagToNote"
  | "listNoteTags"
  | "updateNoteTag"
  | "deleteNoteTag"
  | "saveNoteImage"
  | "getNoteImage"
>;

type NotesViewProps = {
  db?: NotesDb;
  refreshKey?: number;
  onToast?: (message: string) => void;
};

const ignoreToast = () => undefined;

function toMapById<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export default function NotesView({
  db = getDb(),
  refreshKey = 0,
  onToast = ignoreToast,
}: NotesViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [peopleById, setPeopleById] = useState<Map<number, Person>>(
    () => new Map(),
  );
  const [initiativesById, setInitiativesById] = useState<
    Map<number, Initiative>
  >(() => new Map());
  const [tagCatalog, setTagCatalog] = useState<NoteTag[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    try {
      const [listed, catalog, people, initiatives] = await Promise.all([
        db.listActiveNotes(),
        db.listNoteTags(),
        db.listPeople(),
        db.listInitiatives(),
      ]);
      setNotes(listed);
      setTagCatalog(catalog);
      setPeopleById(toMapById(people));
      setInitiativesById(toMapById(initiatives));
    } catch {
      onToast("Notlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, onToast]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes, refreshKey]);

  const saveNote = async (
    id: number,
    body: string,
    reminder: ReminderDraft | null,
  ) => {
    if (!body.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    if (reminder && !reminder.dueAt) {
      onToast("Hatırlatma zamanı gerekli");
      return;
    }

    try {
      await db.updateNote(id, body);
    } catch {
      onToast("Not güncellenemedi");
      return;
    }

    let reminderFailed = false;
    if (reminder) {
      try {
        await db.createReminder({
          targetType: "note",
          targetId: id,
          dueAt: new Date(reminder.dueAt).toISOString(),
          period: reminder.period,
          nowIso: new Date().toISOString(),
        });
      } catch {
        reminderFailed = true;
      }
    }

    setEditingNoteId(null);
    await loadNotes();
    if (reminderFailed) {
      onToast("Not kaydedildi, hatırlatma eklenemedi");
    }
  };

  const deleteNote = async (id: number) => {
    try {
      await db.softDeleteNote(id, new Date().toISOString());
      if (editingNoteId === id) {
        setEditingNoteId(null);
      }
      onToast("Not arşivlendi");
      await loadNotes();
    } catch {
      onToast("Not arşivlenemedi");
    }
  };

  return (
    <section className="notes-view">
      <h1>Notlar</h1>
      {loading ? (
        <p>Notlar yükleniyor…</p>
      ) : (
        <NoteList
          editingNoteId={editingNoteId}
          getNoteImage={(id) => db.getNoteImage(id)}
          initiativesById={initiativesById}
          notes={notes}
          onAddTag={async (noteId, name, color) => {
            await db.addTagToNote(noteId, { name, color });
            await loadNotes();
          }}
          onDelete={deleteNote}
          onDeleteTag={async (tagId) => {
            await db.deleteNoteTag(tagId);
            await loadNotes();
          }}
          onEdit={setEditingNoteId}
          onLinkTag={async (noteId, tagId) => {
            await db.linkTagToNote(noteId, tagId);
            await loadNotes();
          }}
          onSave={saveNote}
          onToast={onToast}
          saveNoteImage={(input) => db.saveNoteImage(input)}
          onUpdateTag={async (tagId, patch) => {
            await db.updateNoteTag(tagId, patch);
            await loadNotes();
          }}
          peopleById={peopleById}
          tagCatalog={tagCatalog}
        />
      )}
    </section>
  );
}
