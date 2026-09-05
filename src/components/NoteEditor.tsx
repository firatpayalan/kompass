import { useEffect, useState } from "react";
import type { Note } from "../lib/types";

type NoteEditorProps = {
  note: Note;
  editing: boolean;
  onEdit: () => void;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
};

export default function NoteEditor({
  note,
  editing,
  onEdit,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [body, setBody] = useState(note.body);
  const [saving, setSaving] = useState(false);

  useEffect(() => setBody(note.body), [note.body]);

  if (!editing) {
    return (
      <button className="note-editor__preview" onClick={onEdit} type="button">
        {note.body}
      </button>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      await onSave(body);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="note-editor">
      <label>
        Not metni
        <textarea
          autoFocus
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          value={body}
        />
      </label>
      <div className="note-editor__actions">
        <button onClick={onCancel} type="button">
          Vazgeç
        </button>
        <button disabled={saving} onClick={save} type="button">
          Değişiklikleri kaydet
        </button>
      </div>
    </div>
  );
}
