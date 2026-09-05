import { useState } from "react";
import type { Note, NoteTag } from "../lib/types";
import type { PersonLabelColor } from "../lib/personLabels";
import NoteArchiveShell from "./NoteArchiveShell";
import NoteTagBadges from "./NoteTagBadges";
import NoteTimestamps from "./NoteTimestamps";
import ReminderForm, { type ReminderDraft } from "./ReminderForm";
import TopicTagsEditor from "./TopicTagsEditor";
import { reminderUrgency } from "../lib/reminderUrgency";
import type { ReminderPeriod } from "../lib/types";

type LinkedNotesProps = {
  loading: boolean;
  notes: Note[];
  label?: string;
  emptyLabel?: string;
  onUpdateNote?: (
    noteId: number,
    body: string,
    reminder: ReminderDraft | null,
  ) => Promise<void>;
  onArchiveNote?: (noteId: number) => Promise<void>;
  tagCatalog?: NoteTag[];
  onAddTag?: (
    noteId: number,
    name: string,
    color: PersonLabelColor,
  ) => Promise<void>;
  onLinkTag?: (noteId: number, tagId: number) => Promise<void>;
  onUpdateTag?: (
    id: number,
    patch: { name?: string; color?: PersonLabelColor },
  ) => Promise<void>;
  onDeleteTag?: (id: number) => Promise<void>;
  onToast?: (message: string) => void;
  topicOptions?: { id: number; title: string }[];
  onMoveToTopic?: (noteId: number, topicId: number) => Promise<void>;
  now?: () => Date;
};

export default function LinkedNotes({
  loading,
  notes,
  label = "Bağlı notlar",
  emptyLabel = "Henüz bağlı not yok.",
  onUpdateNote,
  onArchiveNote,
  tagCatalog,
  onAddTag,
  onLinkTag,
  onUpdateTag,
  onDeleteTag,
  onToast = () => undefined,
  topicOptions,
  onMoveToTopic,
  now = () => new Date(),
}: LinkedNotesProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [period, setPeriod] = useState<ReminderPeriod>("once");
  const [moveTopicByNote, setMoveTopicByNote] = useState<
    Record<number, string>
  >({});
  const [movingId, setMovingId] = useState<number | null>(null);
  const canEditTags = Boolean(onAddTag && onUpdateTag && onDeleteTag);
  const canMove = Boolean(
    topicOptions && topicOptions.length > 0 && onMoveToTopic,
  );

  if (loading) {
    return <p>{label} yükleniyor…</p>;
  }

  if (notes.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setDraft(note.body);
    setReminderEnabled(false);
    setDueAt("");
    setPeriod("once");
  };

  const saveEdit = async () => {
    if (editingId === null || !onUpdateNote) return;
    if (reminderEnabled && !dueAt) {
      onToast("Hatırlatma zamanı gerekli");
      return;
    }
    setSaving(true);
    try {
      await onUpdateNote(
        editingId,
        draft,
        reminderEnabled ? { dueAt, period } : null,
      );
      setEditingId(null);
      setReminderEnabled(false);
      setDueAt("");
      setPeriod("once");
    } finally {
      setSaving(false);
    }
  };

  return (
    <NoteArchiveShell
      enabled={Boolean(onArchiveNote)}
      onArchive={async (noteId) => {
        await onArchiveNote?.(noteId);
      }}
    >
      {({ openArchiveMenu }) => (
        <ul aria-label={label} className="linked-note-list">
          {notes.map((note) => {
            const urgency = reminderUrgency(note.nextReminderDueAt, now());
            const className = [
              "linked-note-list__item",
              urgency === "overdue" ? "linked-note-list__item--overdue" : null,
              urgency === "soon" ? "linked-note-list__item--soon" : null,
            ]
              .filter(Boolean)
              .join(" ");

            return (
            <li
              key={note.id}
              className={className}
              onContextMenu={
                onArchiveNote
                  ? (event) => openArchiveMenu(event, note)
                  : undefined
              }
            >
              {editingId === note.id ? (
                <div className="linked-note-edit">
                  <label>
                    Notu düzenle
                    <textarea
                      autoFocus
                      onChange={(event) => setDraft(event.target.value)}
                      rows={3}
                      value={draft}
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
                  <div className="linked-note-edit__actions">
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setReminderEnabled(false);
                        setDueAt("");
                        setPeriod("once");
                      }}
                      type="button"
                    >
                      Vazgeç
                    </button>
                    <button disabled={saving} onClick={saveEdit} type="button">
                      {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p>{note.body}</p>
                  <div className="linked-note-meta">
                    <NoteTimestamps note={note} />
                    {onUpdateNote ? (
                      <button
                        onClick={() => startEdit(note)}
                        type="button"
                      >
                        Düzenle
                      </button>
                    ) : null}
                  </div>
                  {canMove ? (
                    <div className="linked-note-move">
                      <label>
                        Konuya taşı
                        <select
                          onChange={(event) =>
                            setMoveTopicByNote((prev) => ({
                              ...prev,
                              [note.id]: event.target.value,
                            }))
                          }
                          value={moveTopicByNote[note.id] ?? ""}
                        >
                          <option value="">Konu seç…</option>
                          {topicOptions!.map((topic) => (
                            <option key={topic.id} value={topic.id}>
                              {topic.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        disabled={movingId === note.id}
                        onClick={() => {
                          void (async () => {
                            const raw = moveTopicByNote[note.id] ?? "";
                            const topicId = Number(raw);
                            if (!raw || Number.isNaN(topicId)) {
                              onToast("Konu seçin");
                              return;
                            }
                            setMovingId(note.id);
                            try {
                              await onMoveToTopic?.(note.id, topicId);
                            } finally {
                              setMovingId(null);
                            }
                          })();
                        }}
                        type="button"
                      >
                        {movingId === note.id ? "Taşınıyor…" : "Taşı"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
              {canEditTags ? (
                <TopicTagsEditor
                  catalog={tagCatalog}
                  colorInputName={`note-tag-color-${note.id}`}
                  onAdd={async (name, color) => {
                    await onAddTag?.(note.id, name, color);
                  }}
                  onDelete={async (tagId) => {
                    await onDeleteTag?.(tagId);
                  }}
                  onLinkExisting={
                    onLinkTag
                      ? async (tagId) => {
                          await onLinkTag(note.id, tagId);
                        }
                      : undefined
                  }
                  onToast={onToast}
                  onUpdate={async (tagId, patch) => {
                    await onUpdateTag?.(tagId, patch);
                  }}
                  tags={note.tags}
                />
              ) : (
                <NoteTagBadges tags={note.tags} />
              )}
            </li>
            );
          })}
        </ul>
      )}
    </NoteArchiveShell>
  );
}
