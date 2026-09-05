import { useEffect, useState } from "react";
import LinkedNotes from "../components/LinkedNotes";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Note, Person } from "../lib/types";

type PersonDetailViewProps = {
  db?: Pick<AppDb, "listNotesForPerson">;
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.listNotesForPerson(person.id)
      .then((loaded) => {
        if (active) {
          setNotes(loaded);
        }
      })
      .catch(() => {
        if (active) {
          onToast("Bağlı notlar yüklenemedi");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [db, onToast, person.id]);

  return (
    <section className="detail-view">
      <button className="back-button" onClick={onBack} type="button">
        ← Kişilere dön
      </button>
      <h1>{person.name}</h1>
      {person.roleOrNotes ? <p>{person.roleOrNotes}</p> : null}
      <h2>Bağlı notlar</h2>
      <LinkedNotes loading={loading} notes={notes} />
    </section>
  );
}
