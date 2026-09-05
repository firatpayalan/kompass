import type { Initiative, Note, NoteTag, Person } from "../lib/types";
import type { PersonLabelColor } from "../lib/personLabels";
import NoteArchiveShell from "./NoteArchiveShell";
import NoteEditor from "./NoteEditor";
import NoteLinkBadges from "./NoteLinkBadges";
import NoteTimestamps from "./NoteTimestamps";
import TopicTagsEditor from "./TopicTagsEditor";
import type { ReminderDraft } from "./ReminderForm";

type NoteListProps = {
  notes: Note[];
  peopleById?: Map<number, Person>;
  initiativesById?: Map<number, Initiative>;
  editingNoteId: number | null;
  onEdit: (id: number | null) => void;
  onSave: (
    id: number,
    body: string,
    reminder: ReminderDraft | null,
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
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
};

export default function NoteList({
  notes,
  peopleById = new Map(),
  initiativesById = new Map(),
  editingNoteId,
  onEdit,
  onSave,
  onDelete,
  tagCatalog,
  onAddTag,
  onLinkTag,
  onUpdateTag,
  onDeleteTag,
  onToast = () => undefined,
}: NoteListProps) {
  if (notes.length === 0) {
    return <p>Henüz not yok.</p>;
  }

  const canEditTags = Boolean(onAddTag && onUpdateTag && onDeleteTag);

  return (
    <NoteArchiveShell enabled onArchive={onDelete}>
      {({ openArchiveMenu }) => (
        <ul className="note-list">
          {notes.map((note) => (
            <li
              className="note-list__item"
              key={note.id}
              onContextMenu={(event) => openArchiveMenu(event, note)}
            >
              <NoteEditor
                editing={editingNoteId === note.id}
                note={note}
                onCancel={() => onEdit(null)}
                onEdit={() => onEdit(note.id)}
                onSave={(body, reminder) => onSave(note.id, body, reminder)}
              />
              <NoteLinkBadges
                initiativesById={initiativesById}
                note={note}
                peopleById={peopleById}
              />
              {canEditTags ? (
                <TopicTagsEditor
                  catalog={tagCatalog}
                  colorInputName={`note-list-tag-color-${note.id}`}
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
              ) : null}
              <div className="note-list__meta">
                <NoteTimestamps note={note} />
                <button onClick={() => onDelete(note.id)} type="button">
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </NoteArchiveShell>
  );
}
