import { useCallback, useEffect, useState } from "react";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Initiative, Note, Person } from "../lib/types";

type InboxDb = Pick<
  AppDb,
  | "listInboxNotes"
  | "listPeople"
  | "listInitiatives"
  | "linkNoteToPeople"
  | "linkNoteToInitiatives"
  | "softDeleteNote"
  | "updateNote"
>;

type InboxViewProps = {
  db?: InboxDb;
  refreshKey?: number;
  onToast?: (message: string) => void;
};

const ignoreToast = () => undefined;

export default function InboxView({
  db = getDb(),
  refreshKey = 0,
  onToast = ignoreToast,
}: InboxViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [organizingId, setOrganizingId] = useState<number | null>(null);
  const [personIds, setPersonIds] = useState<number[]>([]);
  const [initiativeIds, setInitiativeIds] = useState<number[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inbox, nextPeople, nextInitiatives] = await Promise.all([
        db.listInboxNotes(),
        db.listPeople(),
        db.listInitiatives(),
      ]);
      setNotes(inbox);
      setPeople(nextPeople);
      setInitiatives(nextInitiatives);
    } catch {
      onToast("Gelen kutusu yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, onToast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const startOrganize = (note: Note) => {
    setOrganizingId(note.id);
    setBody(note.body);
    setPersonIds([]);
    setInitiativeIds([]);
  };

  const toggleId = (
    id: number,
    selected: number[],
    setSelected: (ids: number[]) => void,
  ) => {
    setSelected(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  };

  const saveOrganize = async () => {
    if (organizingId === null) return;
    if (!body.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    if (personIds.length === 0 && initiativeIds.length === 0) {
      onToast("En az bir kişi veya iş seçin");
      return;
    }

    setSaving(true);
    try {
      await db.updateNote(organizingId, body);
      await db.linkNoteToPeople(organizingId, personIds);
      await db.linkNoteToInitiatives(organizingId, initiativeIds);
      setOrganizingId(null);
      onToast("Not taşındı");
      await load();
    } catch {
      onToast("Not taşınamadı");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id: number) => {
    try {
      await db.softDeleteNote(id, new Date().toISOString());
      if (organizingId === id) setOrganizingId(null);
      await load();
    } catch {
      onToast("Not silinemedi");
    }
  };

  return (
    <section className="notes-view">
      <h1>Gelen</h1>
      <p className="view-subtitle">
        Hızlı notlar burada birikir. Toplantı sonrası kişi veya işe taşıyın.
      </p>
      {loading ? (
        <p>Gelen kutusu yükleniyor…</p>
      ) : notes.length === 0 ? (
        <p>Gelen kutusu boş.</p>
      ) : (
        <ul className="note-list">
          {notes.map((note) => (
            <li className="note-list__item" key={note.id}>
              {organizingId === note.id ? (
                <div className="inbox-organize">
                  <label>
                    Not metni
                    <textarea
                      autoFocus
                      onChange={(event) => setBody(event.target.value)}
                      rows={4}
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
                            onChange={() =>
                              toggleId(person.id, personIds, setPersonIds)
                            }
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
                  <div className="note-editor__actions">
                    <button
                      onClick={() => setOrganizingId(null)}
                      type="button"
                    >
                      Vazgeç
                    </button>
                    <button
                      disabled={saving}
                      onClick={saveOrganize}
                      type="button"
                    >
                      {saving ? "Taşınıyor…" : "Taşı"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="note-editor__preview">{note.body}</p>
                  {note.tags.length > 0 ? (
                    <div className="note-list__tags">
                      {note.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="note-list__meta">
                    <time dateTime={note.createdAt}>
                      {new Date(note.createdAt).toLocaleString("tr-TR")}
                    </time>
                    <button
                      onClick={() => startOrganize(note)}
                      type="button"
                    >
                      Taşı
                    </button>
                    <button onClick={() => deleteNote(note.id)} type="button">
                      Sil
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
