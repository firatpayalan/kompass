import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import LinkedNotes from "../components/LinkedNotes";
import NoteBodyView from "../components/NoteBodyView";
import NoteTagBadges from "../components/NoteTagBadges";
import PersonLabelBadge from "../components/PersonLabelBadge";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { TopicWithNotes } from "../db/topicsRepo";
import type { Initiative, InitiativeStatus, Note, Person } from "../lib/types";

type ArchiveDb = Pick<
  AppDb,
  | "listArchivedPeople"
  | "listArchivedInitiatives"
  | "listTopicsWithNotesForPerson"
  | "listNotesForInitiative"
  | "restorePerson"
  | "restoreInitiative"
  | "listDeletedNotes"
  | "restoreNote"
  | "permanentlyDeleteNote"
  | "getNoteImage"
>;

type ArchiveViewProps = {
  db?: ArchiveDb;
  onToast?: (message: string) => void;
};

const ignoreToast = () => undefined;

const statusLabels: Record<InitiativeStatus, string> = {
  aktif: "Aktif",
  beklemede: "Beklemede",
  bitti: "Bitti",
};

export default function ArchiveView({
  db = getDb(),
  onToast = ignoreToast,
}: ArchiveViewProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPersonId, setExpandedPersonId] = useState<number | null>(null);
  const [expandedInitiativeId, setExpandedInitiativeId] = useState<
    number | null
  >(null);
  const [topics, setTopics] = useState<TopicWithNotes[]>([]);
  const [untopicNotes, setUntopicNotes] = useState<Note[]>([]);
  const [initiativeNotes, setInitiativeNotes] = useState<Note[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [restoringPersonId, setRestoringPersonId] = useState<number | null>(
    null,
  );
  const [restoringInitiativeId, setRestoringInitiativeId] = useState<
    number | null
  >(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const loadArchive = useCallback(async () => {
    try {
      const [archivedPeople, archivedInitiatives, deletedNotes] =
        await Promise.all([
          db.listArchivedPeople(),
          db.listArchivedInitiatives(),
          db.listDeletedNotes(),
        ]);
      setPeople(archivedPeople);
      setInitiatives(archivedInitiatives);
      setNotes(deletedNotes);
    } catch {
      onToast("Arşiv yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, onToast]);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  const loadPersonDetail = useCallback(
    async (personId: number) => {
      setDetailLoading(true);
      try {
        const result = await db.listTopicsWithNotesForPerson(personId, {
          includeDeletedNotes: true,
        });
        setTopics(result.topics);
        setUntopicNotes(result.untopicNotes);
      } catch {
        onToast("Arşiv detayı yüklenemedi");
        setTopics([]);
        setUntopicNotes([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [db, onToast],
  );

  const loadInitiativeDetail = useCallback(
    async (initiativeId: number) => {
      setDetailLoading(true);
      try {
        const linked = await db.listNotesForInitiative(initiativeId, {
          includeDeleted: true,
        });
        setInitiativeNotes(linked);
      } catch {
        onToast("Arşiv detayı yüklenemedi");
        setInitiativeNotes([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [db, onToast],
  );

  const togglePerson = (personId: number) => {
    if (expandedPersonId === personId) {
      setExpandedPersonId(null);
      return;
    }
    setExpandedInitiativeId(null);
    setExpandedPersonId(personId);
    void loadPersonDetail(personId);
  };

  const toggleInitiative = (initiativeId: number) => {
    if (expandedInitiativeId === initiativeId) {
      setExpandedInitiativeId(null);
      return;
    }
    setExpandedPersonId(null);
    setExpandedInitiativeId(initiativeId);
    void loadInitiativeDetail(initiativeId);
  };

  const restorePerson = async (person: Person) => {
    setRestoringPersonId(person.id);
    try {
      await db.restorePerson(person.id);
      onToast("Kişi geri yüklendi");
      if (expandedPersonId === person.id) {
        setExpandedPersonId(null);
      }
      await loadArchive();
    } catch {
      onToast("Kişi geri yüklenemedi");
    } finally {
      setRestoringPersonId(null);
    }
  };

  const restoreInitiative = async (initiative: Initiative) => {
    setRestoringInitiativeId(initiative.id);
    try {
      await db.restoreInitiative(initiative.id);
      onToast("İş geri yüklendi");
      if (expandedInitiativeId === initiative.id) {
        setExpandedInitiativeId(null);
      }
      await loadArchive();
    } catch {
      onToast("İş geri yüklenemedi");
    } finally {
      setRestoringInitiativeId(null);
    }
  };

  const restoreNote = async (id: number) => {
    try {
      await db.restoreNote(id);
      onToast("Not geri yüklendi");
      await loadArchive();
    } catch {
      onToast("Not geri yüklenemedi");
    }
  };

  const permanentlyDelete = async () => {
    if (!noteToDelete) return;
    try {
      await db.permanentlyDeleteNote(noteToDelete.id);
      setNoteToDelete(null);
      onToast("Not kalıcı olarak silindi");
      await loadArchive();
    } catch {
      onToast("Not kalıcı olarak silinemedi");
    }
  };

  const empty =
    people.length === 0 && initiatives.length === 0 && notes.length === 0;

  return (
    <section className="entity-view">
      <header>
        <div>
          <h1>Arşiv</h1>
          <p>Arşivlenmiş notlar, kişiler ve işler.</p>
        </div>
      </header>
      {loading ? (
        <p>Arşiv yükleniyor…</p>
      ) : empty ? (
        <p>Arşiv boş.</p>
      ) : (
        <>
          {notes.length > 0 ? (
            <>
              <h2>Arşivlenmiş notlar</h2>
              <ul aria-label="Arşivlenmiş notlar" className="note-list">
                {notes.map((note) => (
                  <li className="note-list__item" key={note.id}>
                    <NoteBodyView
                      body={note.body}
                      className="note-editor__preview"
                      getNoteImage={(id) => db.getNoteImage(id)}
                    />
                    <NoteTagBadges tags={note.tags} />
                    <div className="note-list__meta">
                      <time dateTime={note.deletedAt ?? note.updatedAt}>
                        {new Date(
                          note.deletedAt ?? note.updatedAt,
                        ).toLocaleString("tr-TR")}
                      </time>
                      <div className="note-editor__actions">
                        <button
                          onClick={() => void restoreNote(note.id)}
                          type="button"
                        >
                          Geri yükle
                        </button>
                        <button
                          onClick={() => setNoteToDelete(note)}
                          type="button"
                        >
                          Kalıcı sil
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {people.length > 0 ? (
            <>
              <h2>Arşivlenmiş kişiler</h2>
              <ul className="archive-list">
                {people.map((person) => {
                  const expanded = expandedPersonId === person.id;
                  return (
                    <li className="archive-list__item" key={person.id}>
                      <div className="archive-list__row">
                        <button
                          aria-expanded={expanded}
                          className="archive-list__toggle"
                          onClick={() => togglePerson(person.id)}
                          type="button"
                        >
                          <span aria-hidden="true">
                            {expanded ? "▾" : "▸"}
                          </span>
                          <span className="archive-list__name">
                            <strong>{person.name}</strong>
                            {person.label ? (
                              <PersonLabelBadge label={person.label} />
                            ) : null}
                          </span>
                          {person.archivedAt ? (
                            <time dateTime={person.archivedAt}>
                              {new Date(person.archivedAt).toLocaleString(
                                "tr-TR",
                              )}
                            </time>
                          ) : null}
                        </button>
                        <button
                          disabled={restoringPersonId === person.id}
                          onClick={() => void restorePerson(person)}
                          type="button"
                        >
                          {restoringPersonId === person.id
                            ? "Yükleniyor…"
                            : "Geri yükle"}
                        </button>
                      </div>
                      {expanded ? (
                        <div className="archive-list__detail">
                          {detailLoading ? (
                            <p>Yükleniyor…</p>
                          ) : (
                            <>
                              {topics.map((topic) => (
                                <article className="topic-card" key={topic.id}>
                                  <h3 className="archive-list__topic-title">
                                    {topic.title}
                                  </h3>
                                  <LinkedNotes
                                    emptyLabel="Bu konuda not yok."
                                    getNoteImage={(id) => db.getNoteImage(id)}
                                    label={`${topic.title} notları`}
                                    loading={false}
                                    notes={topic.notes}
                                  />
                                </article>
                              ))}
                              {untopicNotes.length > 0 ? (
                                <>
                                  <h3 className="archive-list__topic-title">
                                    Konusuz notlar
                                  </h3>
                                  <LinkedNotes
                                    emptyLabel="Konusuz not yok."
                                    getNoteImage={(id) => db.getNoteImage(id)}
                                    label="Konusuz notlar"
                                    loading={false}
                                    notes={untopicNotes}
                                  />
                                </>
                              ) : null}
                              {topics.length === 0 &&
                              untopicNotes.length === 0 ? (
                                <p>Bu kişiye ait not yok.</p>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {initiatives.length > 0 ? (
            <>
              <h2>Arşivlenmiş işler</h2>
              <ul className="archive-list">
                {initiatives.map((initiative) => {
                  const expanded = expandedInitiativeId === initiative.id;
                  return (
                    <li className="archive-list__item" key={initiative.id}>
                      <div className="archive-list__row">
                        <button
                          aria-expanded={expanded}
                          className="archive-list__toggle"
                          onClick={() => toggleInitiative(initiative.id)}
                          type="button"
                        >
                          <span aria-hidden="true">
                            {expanded ? "▾" : "▸"}
                          </span>
                          <span className="archive-list__name">
                            <strong>{initiative.name}</strong>
                            <span
                              className={`status status--${initiative.status}`}
                            >
                              {statusLabels[initiative.status]}
                            </span>
                          </span>
                          {initiative.archivedAt ? (
                            <time dateTime={initiative.archivedAt}>
                              {new Date(initiative.archivedAt).toLocaleString(
                                "tr-TR",
                              )}
                            </time>
                          ) : null}
                        </button>
                        <button
                          disabled={restoringInitiativeId === initiative.id}
                          onClick={() => void restoreInitiative(initiative)}
                          type="button"
                        >
                          {restoringInitiativeId === initiative.id
                            ? "Yükleniyor…"
                            : "Geri yükle"}
                        </button>
                      </div>
                      {expanded ? (
                        <div className="archive-list__detail">
                          {detailLoading ? (
                            <p>Yükleniyor…</p>
                          ) : (
                            <LinkedNotes
                              emptyLabel="Bu işe ait not yok."
                              getNoteImage={(id) => db.getNoteImage(id)}
                              label={`${initiative.name} notları`}
                              loading={false}
                              notes={initiativeNotes}
                            />
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </>
      )}
      {noteToDelete ? (
        <ConfirmDialog
          message="Bu not kalıcı olarak silinecek. Emin misiniz?"
          onCancel={() => setNoteToDelete(null)}
          onConfirm={() => void permanentlyDelete()}
        />
      ) : null}
    </section>
  );
}
