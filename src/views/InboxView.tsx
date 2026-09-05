import { useCallback, useEffect, useState } from "react";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Initiative, Note, Person } from "../lib/types";
import NoteArchiveShell from "../components/NoteArchiveShell";
import NoteBodyField from "../components/NoteBodyField";
import NoteBodyView from "../components/NoteBodyView";
import NoteTagBadges from "../components/NoteTagBadges";
import NoteTimestamps from "../components/NoteTimestamps";

type InboxDb = Pick<
  AppDb,
  | "listInboxNotes"
  | "listPeople"
  | "listInitiatives"
  | "linkNoteToPeople"
  | "linkNoteToInitiatives"
  | "softDeleteNote"
  | "updateNote"
  | "saveNoteImage"
  | "getNoteImage"
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
      onToast("Not arşivlendi");
      await load();
    } catch {
      onToast("Not arşivlenemedi");
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
        <NoteArchiveShell enabled onArchive={deleteNote}>
          {({ openArchiveMenu }) => (
        <ul className="note-list">
          {notes.map((note) => (
            <li
              className="note-list__item"
              key={note.id}
              onContextMenu={
                organizingId === note.id
                  ? undefined
                  : (event) => openArchiveMenu(event, note)
              }
            >
              {organizingId === note.id ? (
                <div className="inbox-organize">
                  <NoteBodyField
                    autoFocus
                    className="inbox-organize__field"
                    label="Not metni"
                    onChange={setBody}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        if (saving) return;
                        void saveOrganize();
                      }
                    }}
                    onToast={onToast}
                    rows={4}
                    saveNoteImage={(input) => db.saveNoteImage(input)}
                    value={body}
                  />
                  <div className="inbox-organize__targets">
                    <section
                      aria-labelledby={`inbox-people-${note.id}`}
                      className="inbox-organize__group"
                    >
                      <h3 id={`inbox-people-${note.id}`}>Kişiler</h3>
                      {people.length === 0 ? (
                        <p className="inbox-organize__empty">Kişi yok</p>
                      ) : (
                        <div className="inbox-organize__chips">
                          {people.map((person) => (
                            <label
                              className={`inbox-organize__chip${
                                personIds.includes(person.id)
                                  ? " inbox-organize__chip--selected"
                                  : ""
                              }`}
                              key={person.id}
                            >
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
                        </div>
                      )}
                    </section>
                    <section
                      aria-labelledby={`inbox-initiatives-${note.id}`}
                      className="inbox-organize__group"
                    >
                      <h3 id={`inbox-initiatives-${note.id}`}>İşler</h3>
                      {initiatives.length === 0 ? (
                        <p className="inbox-organize__empty">İş yok</p>
                      ) : (
                        <div className="inbox-organize__chips">
                          {initiatives.map((initiative) => (
                            <label
                              className={`inbox-organize__chip${
                                initiativeIds.includes(initiative.id)
                                  ? " inbox-organize__chip--selected"
                                  : ""
                              }`}
                              key={initiative.id}
                            >
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
                        </div>
                      )}
                    </section>
                  </div>
                  <div className="inbox-organize__actions">
                    <button
                      onClick={() => setOrganizingId(null)}
                      type="button"
                    >
                      Vazgeç
                    </button>
                    <button
                      className="inbox-organize__primary"
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
                  <NoteBodyView
                    body={note.body}
                    className="note-editor__preview"
                    getNoteImage={(id) => db.getNoteImage(id)}
                  />
                  <NoteTagBadges tags={note.tags} />
                  <div className="note-list__meta">
                    <NoteTimestamps note={note} />
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
        </NoteArchiveShell>
      )}
    </section>
  );
}
