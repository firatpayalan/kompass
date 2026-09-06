import { useCallback, useEffect, useState, type MouseEvent } from "react";
import LinkedNotes from "../components/LinkedNotes";
import NoteBodyField from "../components/NoteBodyField";
import ReminderForm, {
  type ReminderDraft,
} from "../components/ReminderForm";
import TopicTagsEditor from "../components/TopicTagsEditor";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { TopicWithNotes } from "../db/topicsRepo";
import type { PersonLabelColor } from "../lib/personLabels";
import type {
  Initiative,
  InitiativeStatus,
  InitiativeTag,
  Note,
  NoteTag,
  ReminderPeriod,
  TopicTag,
} from "../lib/types";

type InitiativeDetailDb = Pick<
  AppDb,
  | "createReminder"
  | "createNote"
  | "createTopic"
  | "listTopicsWithNotesForInitiative"
  | "updateInitiative"
  | "updateNote"
  | "softDeleteNote"
  | "updateTopic"
  | "addTagToTopic"
  | "linkTagToTopic"
  | "listTopicTags"
  | "updateTopicTag"
  | "deleteTopicTag"
  | "addTagToInitiative"
  | "linkTagToInitiative"
  | "listInitiativeTags"
  | "updateInitiativeTag"
  | "deleteInitiativeTag"
  | "removeTagFromInitiative"
  | "addTagToNote"
  | "linkTagToNote"
  | "listNoteTags"
  | "updateNoteTag"
  | "deleteNoteTag"
  | "linkNoteToTopics"
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
  const [topicTagCatalog, setTopicTagCatalog] = useState<TopicTag[]>([]);
  const [noteTagCatalog, setNoteTagCatalog] = useState<NoteTag[]>([]);
  const [initiativeTagCatalog, setInitiativeTagCatalog] = useState<
    InitiativeTag[]
  >([]);
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

  useEffect(() => {
    setCurrent(initiative);
    setStatus(initiative.status);
    setBlockerSummary(initiative.blockerSummary ?? "");
  }, [initiative]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, topicCatalog, noteCatalog, initiativeCatalog] =
        await Promise.all([
          db.listTopicsWithNotesForInitiative(initiative.id),
          db.listTopicTags(),
          db.listNoteTags(),
          db.listInitiativeTags(),
        ]);
      setTopics(result.topics);
      setUntopicNotes(result.untopicNotes);
      setTopicTagCatalog(topicCatalog);
      setNoteTagCatalog(noteCatalog);
      setInitiativeTagCatalog(initiativeCatalog);
    } catch {
      onToast("Konular yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, initiative.id, onToast]);

  useEffect(() => {
    void load();
  }, [load]);

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
          await load();
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
        initiativeId: initiative.id,
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
        initiativeIds: [initiative.id],
        personIds: [],
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

    await load();
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
      await load();
    } catch {
      onToast("Not arşivlenemedi");
    }
  };

  const moveNoteToTopic = async (noteId: number, topicId: number) => {
    try {
      await db.linkNoteToTopics(noteId, [topicId]);
      onToast("Nota konu bağlandı");
      setExpandedTopicIds((prev) => new Set(prev).add(topicId));
      await load();
    } catch {
      onToast("Nota konu bağlanamadı");
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
      await load();
    },
    onLinkTag: async (noteId: number, tagId: number) => {
      await db.linkTagToNote(noteId, tagId);
      await load();
    },
    onUpdateTag: async (
      id: number,
      patch: { name?: string; color?: PersonLabelColor },
    ) => {
      await db.updateNoteTag(id, patch);
      await load();
    },
    onDeleteTag: async (id: number) => {
      await db.deleteNoteTag(id);
      await load();
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
      <div className="person-label-editor">
        <p className="person-label-picker__title">Etiketler</p>
        <TopicTagsEditor
          catalog={initiativeTagCatalog}
          colorInputName="initiative-tag-color"
          onAdd={async (name, color) => {
            const tag = await db.addTagToInitiative(current.id, { name, color });
            setCurrent((prev) => ({
              ...prev,
              tags: prev.tags.some((item) => item.id === tag.id)
                ? prev.tags
                : [...prev.tags, tag],
            }));
            await load();
          }}
          onLinkExisting={async (tagId) => {
            const tag = await db.linkTagToInitiative(current.id, tagId);
            setCurrent((prev) => ({
              ...prev,
              tags: prev.tags.some((item) => item.id === tag.id)
                ? prev.tags
                : [...prev.tags, tag],
            }));
            await load();
          }}
          onUpdate={async (tagId, patch) => {
            const tag = await db.updateInitiativeTag(tagId, patch);
            setCurrent((prev) => ({
              ...prev,
              tags: prev.tags.map((item) =>
                item.id === tag.id ? tag : item,
              ),
            }));
            await load();
          }}
          onDelete={async (tagId) => {
            await db.deleteInitiativeTag(tagId);
            setCurrent((prev) => ({
              ...prev,
              tags: prev.tags.filter((item) => item.id !== tagId),
            }));
            await load();
          }}
          onToast={onToast}
          tags={current.tags}
        />
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
            placeholder="Örn. Lansman, RFC, Bütçe"
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
                <TopicTagsEditor
                  catalog={topicTagCatalog}
                  colorInputName={`topic-tag-color-${topic.id}`}
                  onAdd={async (tagName, tagColor) => {
                    await db.addTagToTopic(topic.id, {
                      name: tagName,
                      color: tagColor,
                    });
                    await load();
                  }}
                  onDelete={async (tagId) => {
                    await db.deleteTopicTag(tagId);
                    await load();
                  }}
                  onLinkExisting={async (tagId) => {
                    await db.linkTagToTopic(topic.id, tagId);
                    await load();
                  }}
                  onToast={onToast}
                  onUpdate={async (tagId, patch) => {
                    await db.updateTopicTag(tagId, patch);
                    await load();
                  }}
                  tags={topic.tags}
                />
                {expanded ? (
                  <div className="topic-card__body">
                    <LinkedNotes
                      emptyLabel="Bu konuda henüz not yok."
                      getNoteImage={(id) => db.getNoteImage(id)}
                      label={`${topic.title} notları`}
                      loading={false}
                      notes={topic.notes}
                      onArchiveNote={archiveNote}
                      onUpdateNote={updateNote}
                      saveNoteImage={(input) => db.saveNoteImage(input)}
                      {...noteTagHandlers}
                    />
                    <form
                      className="topic-note-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void addNoteToTopic(topic.id);
                      }}
                    >
                      <NoteBodyField
                        label="Not ekle"
                        onChange={(value) =>
                          setNoteDrafts((prev) => ({
                            ...prev,
                            [topic.id]: value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            if (savingTopicId === topic.id) return;
                            void addNoteToTopic(topic.id);
                          }
                        }}
                        onToast={onToast}
                        placeholder={`${topic.title} hakkında not…`}
                        rows={3}
                        saveNoteImage={(input) => db.saveNoteImage(input)}
                        value={noteDrafts[topic.id] ?? ""}
                      />
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
            {...noteTagHandlers}
            emptyLabel="Konusuz not yok."
            getNoteImage={(id) => db.getNoteImage(id)}
            label="Konusuz notlar"
            loading={false}
            notes={untopicNotes}
            onArchiveNote={archiveNote}
            onMoveToTopic={topics.length > 0 ? moveNoteToTopic : undefined}
            onToast={onToast}
            onUpdateNote={updateNote}
            saveNoteImage={(input) => db.saveNoteImage(input)}
            topicOptions={
              topics.length > 0
                ? topics.map((topic) => ({
                    id: topic.id,
                    title: topic.title,
                  }))
                : undefined
            }
          />
        </>
      ) : null}
    </section>
  );
}
