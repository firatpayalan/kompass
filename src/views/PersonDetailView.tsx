import { useCallback, useEffect, useState, type MouseEvent } from "react";
import LinkedNotes from "../components/LinkedNotes";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { TopicWithNotes } from "../db/topicsRepo";
import type { Note, Person } from "../lib/types";

type PersonDetailDb = Pick<
  AppDb,
  | "createNote"
  | "createTopic"
  | "listTopicsWithNotesForPerson"
  | "updateNote"
  | "updateTopic"
>;

type PersonDetailViewProps = {
  db?: PersonDetailDb;
  person: Person;
  onBack: () => void;
  onToast?: (message: string) => void;
};

const ignore = () => undefined;

export default function PersonDetailView({
  db = getDb(),
  person,
  onBack,
  onToast = ignore,
}: PersonDetailViewProps) {
  const [topics, setTopics] = useState<TopicWithNotes[]>([]);
  const [untopicNotes, setUntopicNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicTitle, setTopicTitle] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [savingTopicId, setSavingTopicId] = useState<number | null>(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [renamingTopicId, setRenamingTopicId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await db.listTopicsWithNotesForPerson(person.id);
      setTopics(result.topics);
      setUntopicNotes(result.untopicNotes);
    } catch {
      onToast("Konular yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, onToast, person.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTopic = (topicId: number) => {
    setExpandedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const createTopic = async () => {
    if (!topicTitle.trim()) {
      onToast("Konu boş olamaz");
      return;
    }
    setCreatingTopic(true);
    try {
      const topic = await db.createTopic({
        personId: person.id,
        title: topicTitle,
      });
      setTopicTitle("");
      setExpandedTopicIds((prev) => new Set(prev).add(topic.id));
      onToast("Konu eklendi");
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Konu kaydedilemedi";
      onToast(message);
    } finally {
      setCreatingTopic(false);
    }
  };

  const startRename = (topic: TopicWithNotes, event: MouseEvent) => {
    event.stopPropagation();
    setRenamingTopicId(topic.id);
    setRenameDraft(topic.title);
    setExpandedTopicIds((prev) => new Set(prev).add(topic.id));
  };

  const saveRename = async (topicId: number) => {
    if (!renameDraft.trim()) {
      onToast("Konu boş olamaz");
      return;
    }
    setRenaming(true);
    try {
      await db.updateTopic(topicId, renameDraft);
      setRenamingTopicId(null);
      onToast("Konu güncellendi");
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Konu güncellenemedi";
      onToast(message);
    } finally {
      setRenaming(false);
    }
  };

  const addNoteToTopic = async (topicId: number) => {
    const body = noteDrafts[topicId] ?? "";
    if (!body.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    setSavingTopicId(topicId);
    try {
      await db.createNote({
        body,
        personIds: [person.id],
        initiativeIds: [],
        topicIds: [topicId],
      });
      setNoteDrafts((prev) => ({ ...prev, [topicId]: "" }));
      onToast("Not eklendi");
      await load();
    } catch {
      onToast("Not kaydedilemedi");
    } finally {
      setSavingTopicId(null);
    }
  };

  const updateNote = async (noteId: number, body: string) => {
    if (!body.trim()) {
      onToast("Not boş olamaz");
      throw new Error("Not boş olamaz");
    }
    try {
      await db.updateNote(noteId, body);
      onToast("Not güncellendi");
      await load();
    } catch {
      onToast("Not güncellenemedi");
      throw new Error("Not güncellenemedi");
    }
  };

  return (
    <section className="detail-view">
      <button className="back-button" onClick={onBack} type="button">
        ← Kişilere dön
      </button>
      <h1>{person.name}</h1>
      {person.roleOrNotes ? <p>{person.roleOrNotes}</p> : null}

      <form
        className="detail-note-form"
        onSubmit={(event) => {
          event.preventDefault();
          void createTopic();
        }}
      >
        <label>
          Yeni konu
          <input
            onChange={(event) => setTopicTitle(event.target.value)}
            placeholder="Örn. USS Fishkill, 1:1, Performans"
            value={topicTitle}
          />
        </label>
        <button disabled={creatingTopic} type="submit">
          {creatingTopic ? "Ekleniyor…" : "Konu ekle"}
        </button>
      </form>

      <h2>Konular</h2>
      {loading ? (
        <p>Konular yükleniyor…</p>
      ) : topics.length === 0 ? (
        <p>Henüz konu yok. Yukarıdan bir konu ekleyin.</p>
      ) : (
        <div className="topic-list">
          {topics.map((topic) => {
            const expanded = expandedTopicIds.has(topic.id);
            const renamingThis = renamingTopicId === topic.id;
            return (
              <article
                className={`topic-card${expanded ? " topic-card--expanded" : ""}`}
                key={topic.id}
              >
                {renamingThis ? (
                  <form
                    className="topic-rename-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveRename(topic.id);
                    }}
                  >
                    <label>
                      Konu adı
                      <input
                        autoFocus
                        onChange={(event) => setRenameDraft(event.target.value)}
                        value={renameDraft}
                      />
                    </label>
                    <div className="topic-rename-form__actions">
                      <button
                        onClick={() => setRenamingTopicId(null)}
                        type="button"
                      >
                        Vazgeç
                      </button>
                      <button disabled={renaming} type="submit">
                        {renaming ? "Kaydediliyor…" : "Kaydet"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="topic-card__header">
                    <button
                      aria-expanded={expanded}
                      className="topic-card__toggle"
                      onClick={() => toggleTopic(topic.id)}
                      type="button"
                    >
                      <span aria-hidden="true" className="topic-card__chevron">
                        {expanded ? "▾" : "▸"}
                      </span>
                      <span className="topic-card__title">{topic.title}</span>
                      <span className="topic-card__count">
                        {topic.notes.length} not
                      </span>
                    </button>
                    <button
                      className="topic-card__rename"
                      onClick={(event) => startRename(topic, event)}
                      type="button"
                    >
                      Yeniden adlandır
                    </button>
                  </div>
                )}
                {expanded ? (
                  <div className="topic-card__body">
                    <LinkedNotes
                      emptyLabel="Bu konuda henüz not yok."
                      label={`${topic.title} notları`}
                      loading={false}
                      notes={topic.notes}
                      onUpdateNote={updateNote}
                    />
                    <form
                      className="topic-note-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void addNoteToTopic(topic.id);
                      }}
                    >
                      <label>
                        Not ekle
                        <textarea
                          onChange={(event) =>
                            setNoteDrafts((prev) => ({
                              ...prev,
                              [topic.id]: event.target.value,
                            }))
                          }
                          placeholder={`${topic.title} hakkında not…`}
                          rows={3}
                          value={noteDrafts[topic.id] ?? ""}
                        />
                      </label>
                      <button
                        disabled={savingTopicId === topic.id}
                        type="submit"
                      >
                        {savingTopicId === topic.id
                          ? "Kaydediliyor…"
                          : "Not ekle"}
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {untopicNotes.length > 0 ? (
        <>
          <h2>Konusuz notlar</h2>
          <LinkedNotes
            emptyLabel="Konusuz not yok."
            label="Konusuz notlar"
            loading={false}
            notes={untopicNotes}
            onUpdateNote={updateNote}
          />
        </>
      ) : null}
    </section>
  );
}
