import { useEffect, useState } from "react";
import type { Note, ReminderPeriod } from "../lib/types";
import ReminderForm, { type ReminderDraft } from "./ReminderForm";

type NoteEditorProps = {
  note: Note;
  editing: boolean;
  onEdit: () => void;
  onSave: (body: string, reminder: ReminderDraft | null) => Promise<void>;
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
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [period, setPeriod] = useState<ReminderPeriod>("once");

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
      await onSave(body, reminderEnabled ? { dueAt, period } : null);
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
      <ReminderForm
        dueAt={dueAt}
        enabled={reminderEnabled}
        onDueAtChange={setDueAt}
        onEnabledChange={setReminderEnabled}
        onPeriodChange={setPeriod}
        period={period}
      />
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
