import { useCallback, useEffect, useState } from "react";
import PersonForm from "../components/PersonForm";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Person } from "../lib/types";

type PeopleDb = Pick<AppDb, "createPerson" | "listPeople" | "reorderPeople">;

type PeopleViewProps = {
  db?: PeopleDb;
  onSelectPerson?: (person: Person) => void;
  onToast?: (message: string) => void;
};

const ignore = () => undefined;

function namesMatch(left: string, right: string): boolean {
  return left.localeCompare(right, "tr", { sensitivity: "base" }) === 0;
}

function movePerson(
  people: Person[],
  fromId: number,
  toId: number,
): Person[] {
  if (fromId === toId) return people;
  const fromIndex = people.findIndex((person) => person.id === fromId);
  const toIndex = people.findIndex((person) => person.id === toId);
  if (fromIndex < 0 || toIndex < 0) return people;
  const next = [...people];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function PeopleView({
  db = getDb(),
  onSelectPerson = ignore,
  onToast = ignore,
}: PeopleViewProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<number | null>(null);

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

  const applyOrder = async (next: Person[]) => {
    const previous = people;
    setPeople(next);
    try {
      await db.reorderPeople(next.map((person) => person.id));
    } catch {
      setPeople(previous);
      onToast("Sıra kaydedilemedi");
    }
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
            <li
              className={
                dragId === person.id
                  ? "entity-list__row entity-list__row--dragging"
                  : "entity-list__row"
              }
              key={person.id}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fromId = Number(
                  event.dataTransfer.getData("text/person-id") || dragId,
                );
                setDragId(null);
                if (!Number.isFinite(fromId)) return;
                void applyOrder(movePerson(people, fromId, person.id));
              }}
            >
              <button
                aria-label={`${person.name} sırasını değiştir`}
                className="entity-list__handle"
                draggable
                onDragEnd={() => setDragId(null)}
                onDragStart={(event) => {
                  setDragId(person.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "text/person-id",
                    String(person.id),
                  );
                }}
                type="button"
              >
                ⠿
              </button>
              <button
                aria-label={person.name}
                className="entity-list__open"
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
