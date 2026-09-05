import { useCallback, useEffect, useRef, useState } from "react";
import PersonForm from "../components/PersonForm";
import PersonLabelBadge from "../components/PersonLabelBadge";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Person } from "../lib/types";

type PeopleDb = Pick<
  AppDb,
  | "createPerson"
  | "listPeople"
  | "reorderPeople"
  | "listPersonLabels"
  | "createPersonLabel"
  | "updatePersonLabel"
  | "deletePersonLabel"
>;


type PeopleViewProps = {
  db?: PeopleDb;
  onSelectPerson?: (person: Person) => void;
  onToast?: (message: string) => void;
};

const ignore = () => undefined;
const DRAG_THRESHOLD_PX = 6;

function namesMatch(left: string, right: string): boolean {
  return left.localeCompare(right, "tr", { sensitivity: "base" }) === 0;
}

export function movePerson(
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

export function targetPersonIdAtPoint(
  clientY: number,
  rows: Array<{ id: number; top: number; height: number }>,
): number | null {
  for (const row of rows) {
    if (clientY < row.top + row.height / 2) {
      return row.id;
    }
  }
  return rows.length > 0 ? rows[rows.length - 1].id : null;
}

export default function PeopleView({
  db = getDb(),
  onSelectPerson = ignore,
  onToast = ignore,
}: PeopleViewProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const peopleRef = useRef(people);
  const dragRef = useRef<{
    id: number;
    startY: number;
    active: boolean;
    order: Person[];
  } | null>(null);
  const persistOrderRef = useRef<(next: Person[]) => Promise<void>>(
    async () => undefined,
  );

  peopleRef.current = people;

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

  persistOrderRef.current = async (next: Person[]) => {
    try {
      await db.reorderPeople(next.map((person) => person.id));
    } catch {
      onToast("Sıra kaydedilemedi");
      await loadPeople();
    }
  };

  const useExisting = async (name: string) => {
    const loaded = await loadPeople();
    return loaded.find((item) => namesMatch(item.name, name)) ?? null;
  };

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = dragRef.current;
      if (!session) return;

      if (!session.active) {
        if (Math.abs(event.clientY - session.startY) < DRAG_THRESHOLD_PX) {
          return;
        }
        session.active = true;
        setDragId(session.id);
      }

      const rowEls = listRef.current
        ? [...listRef.current.querySelectorAll<HTMLElement>("[data-person-id]")]
        : [];
      const rows = rowEls.map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          id: Number(row.dataset.personId),
          top: rect.top,
          height: rect.height,
        };
      });
      const overId = targetPersonIdAtPoint(event.clientY, rows);
      if (overId == null) return;

      const next = movePerson(session.order, session.id, overId);
      if (next.every((person, index) => person.id === session.order[index]?.id)) {
        return;
      }
      session.order = next;
      setPeople(next);
    };

    const onPointerUp = () => {
      const session = dragRef.current;
      dragRef.current = null;
      setDragId(null);
      if (!session?.active) return;
      void persistOrderRef.current(session.order);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const startPointerDrag = (personId: number, clientY: number) => {
    dragRef.current = {
      id: personId,
      startY: clientY,
      active: false,
      order: peopleRef.current,
    };
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
          createPersonLabel={db.createPersonLabel}
          deletePersonLabel={db.deletePersonLabel}
          listPersonLabels={db.listPersonLabels}
          updatePersonLabel={db.updatePersonLabel}
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
        <ul className="entity-list" ref={listRef}>
          {people.map((person) => (
            <li
              className={
                dragId === person.id
                  ? "entity-list__row entity-list__row--dragging"
                  : "entity-list__row"
              }
              data-person-id={person.id}
              key={person.id}
            >
              <button
                aria-label={`${person.name} sırasını değiştir`}
                className="entity-list__handle"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  startPointerDrag(person.id, event.clientY);
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
                <span className="entity-list__heading">
                  <strong>{person.name}</strong>
                  {person.label ? (
                    <PersonLabelBadge label={person.label} />
                  ) : null}
                </span>
                {person.roleOrNotes ? <span>{person.roleOrNotes}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
