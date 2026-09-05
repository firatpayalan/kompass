import { useCallback, useEffect, useState } from "react";
import LinkedNotes from "../components/LinkedNotes";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Note, Person } from "../lib/types";

type PersonDetailDb = Pick<AppDb, "createNote" | "listNotesForPerson">;

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
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      setNotes(await db.listNotesForPerson(person.id));
    } catch {
      onToast("Bağlı notlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, onToast, person.id]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const saveNote = async () => {
    if (!body.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    setSaving(true);
    try {
      await db.createNote({
        body,
        personIds: [person.id],
        initiativeIds: [],
      });
      setBody("");
      onToast("Not eklendi");
      await loadNotes();
    } catch {
      onToast("Not kaydedilemedi");
    } finally {
      setSaving(false);
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
          void saveNote();
        }}
      >
        <label>
          Bu kişi hakkında not
          <textarea
            onChange={(event) => setBody(event.target.value)}
            placeholder={`${person.name} hakkında not yazın…`}
            rows={4}
            value={body}
          />
        </label>
        <button disabled={saving} type="submit">
          {saving ? "Kaydediliyor…" : "Not ekle"}
        </button>
      </form>

      <h2>Bağlı notlar</h2>
      <LinkedNotes loading={loading} notes={notes} />
    </section>
  );
}
