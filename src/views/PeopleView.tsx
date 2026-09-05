import { useCallback, useEffect, useState } from "react";
import PersonForm from "../components/PersonForm";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Person } from "../lib/types";

type PeopleDb = Pick<AppDb, "createPerson" | "listPeople">;

type PeopleViewProps = {
  db?: PeopleDb;
  onSelectPerson?: (person: Person) => void;
  onToast?: (message: string) => void;
};

const ignore = () => undefined;

function namesMatch(left: string, right: string): boolean {
  return left.localeCompare(right, "tr", { sensitivity: "base" }) === 0;
}

export default function PeopleView({
  db = getDb(),
  onSelectPerson = ignore,
  onToast = ignore,
}: PeopleViewProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPeople = useCallback(async () => {
    try {
      const loaded = await db.listPeople();
      setPeople(loaded);
      return loaded;
    } catch {
      onToast("Kişiler yüklenemedi");
      return [];
    } finally {
      setLoading(false);
    }
  }, [db, onToast]);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const useExisting = async (name: string) => {
    const loaded = await loadPeople();
    return loaded.find((item) => namesMatch(item.name, name)) ?? null;
  };

  return (
    <section className="entity-view">
      <header>
        <div>
          <h1>Kişiler</h1>
          <p>Kişileri ve onlarla bağlantılı notları takip edin.</p>
        </div>
        <PersonForm
          createPerson={db.createPerson}
          onCreated={onSelectPerson}
          onDuplicate={useExisting}
          onToast={onToast}
        />
      </header>
      <h2>Kişi listesi</h2>
      {loading ? (
        <p>Kişiler yükleniyor…</p>
      ) : people.length === 0 ? (
        <p>Henüz kişi yok.</p>
      ) : (
        <ul className="entity-list">
          {people.map((person) => (
            <li key={person.id}>
              <button
                aria-label={person.name}
                onClick={() => onSelectPerson(person)}
                type="button"
              >
                <strong>{person.name}</strong>
                {person.roleOrNotes ? <span>{person.roleOrNotes}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
