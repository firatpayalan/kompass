import { useCallback, useEffect, useState } from "react";
import LinkedNotes from "../components/LinkedNotes";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { TopicWithNotes } from "../db/topicsRepo";
import type { Note, Person } from "../lib/types";

type PersonDetailDb = Pick<
  AppDb,
  "createNote" | "createTopic" | "listTopicsWithNotesForPerson"
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

  const createTopic = async () => {
    if (!topicTitle.trim()) {
      onToast("Konu boş olamaz");
      return;
    }
    setCreatingTopic(true);
    try {
      await db.createTopic({ personId: person.id, title: topicTitle });
      setTopicTitle("");
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
    topicIds: [],        topicIds: [topicId],
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
          {topics.map((topic) => (
            <article className="topic-card" key={topic.id}>
              <h3>{topic.title}</h3>
              <LinkedNotes
                emptyLabel="Bu konuda henüz not yok."
                label={`${topic.title} notları`}
                loading={false}
                notes={topic.notes}
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
                <button disabled={savingTopicId === topic.id} type="submit">
                  {savingTopicId === topic.id ? "Kaydediliyor…" : "Not ekle"}
                </button>
              </form>
            </article>
          ))}
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
          />
        </>
      ) : null}
    </section>
  );
}
