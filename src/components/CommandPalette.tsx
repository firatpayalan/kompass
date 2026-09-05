import { useEffect, useMemo, useState } from "react";
import type { AppDb } from "../db/appDb";
import type { Initiative, Person } from "../lib/types";
import type { SidebarView } from "./Sidebar";

type CommandPaletteDb = Pick<AppDb, "listInitiatives" | "listPeople">;

type CommandPaletteProps = {
  db: CommandPaletteDb;
  onClose: () => void;
  onNavigate: (view: SidebarView) => void;
  onOpenInitiative: (initiative: Initiative) => void;
  onOpenPerson: (person: Person) => void;
  onQuickNote: () => void;
};

type PaletteItem = {
  id: string;
  label: string;
  run: () => void;
};

const viewCommands: Array<{ label: string; view: SidebarView }> = [
  { label: "Bugün", view: "bugun" },
  { label: "Gelen", view: "gelen" },
  { label: "Notlar", view: "notlar" },
  { label: "Kişiler", view: "kisiler" },
  { label: "İşler", view: "isler" },
  { label: "Arama", view: "arama" },
  { label: "Arşiv", view: "arsiv" },
];

const normalize = (value: string) => value.toLocaleLowerCase("tr-TR");

export default function CommandPalette({
  db,
  onClose,
  onNavigate,
  onOpenInitiative,
  onOpenPerson,
  onQuickNote,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([db.listPeople(), db.listInitiatives()]).then(
      ([nextPeople, nextInitiatives]) => {
        if (active) {
          setPeople(nextPeople);
          setInitiatives(nextInitiatives);
        }
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [db]);

  const items = useMemo<PaletteItem[]>(() => {
    const closeAndRun = (run: () => void) => () => {
      onClose();
      run();
    };
    const allItems: PaletteItem[] = [
      {
        id: "quick-note",
        label: "Hızlı not",
        run: closeAndRun(onQuickNote),
      },
      ...viewCommands.map(({ label, view }) => ({
        id: `view-${view}`,
        label,
        run: closeAndRun(() => onNavigate(view)),
      })),
      ...people.map((person) => ({
        id: `person-${person.id}`,
        label: person.name,
        run: closeAndRun(() => onOpenPerson(person)),
      })),
      ...initiatives.map((initiative) => ({
        id: `initiative-${initiative.id}`,
        label: initiative.name,
        run: closeAndRun(() => onOpenInitiative(initiative)),
      })),
    ];
    const normalizedQuery = normalize(query.trim());
    return normalizedQuery
      ? allItems.filter((item) =>
          normalize(item.label).includes(normalizedQuery),
        )
      : allItems;
  }, [
    initiatives,
    onClose,
    onNavigate,
    onOpenInitiative,
    onOpenPerson,
    onQuickNote,
    people,
    query,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      items[activeIndex].run();
    }
  };

  return (
    <div
      aria-labelledby="command-palette-title"
      aria-modal="true"
      className="modal-backdrop"
      role="dialog"
    >
      <section className="command-palette">
        <h2 id="command-palette-title">Komut paleti</h2>
        <input
          aria-activedescendant={items[activeIndex]?.id}
          aria-controls="command-palette-options"
          aria-label="Komut ara"
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Komut, kişi veya iş ara…"
          role="combobox"
          value={query}
        />
        <div id="command-palette-options" role="listbox">
          {items.map((item, index) => (
            <button
              aria-selected={index === activeIndex}
              id={item.id}
              key={item.id}
              onClick={item.run}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              {item.label}
            </button>
          ))}
          {items.length === 0 ? <p>Komut bulunamadı.</p> : null}
        </div>
      </section>
    </div>
  );
}
