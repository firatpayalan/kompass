import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type {
  BugunReminder,
  ReminderTicker,
} from "../hooks/useReminderTicker";
import type { Initiative, Note, Person } from "../lib/types";
import NoteArchiveShell from "../components/NoteArchiveShell";
import NoteTimestamps from "../components/NoteTimestamps";

type BugunDb = Pick<
  AppDb,
  | "listActiveNotes"
  | "softDeleteNote"
  | "listPeople"
  | "listInitiatives"
  | "getNote"
>;

type BugunViewProps = {
  db?: BugunDb;
  ticker: ReminderTicker;
  onToast?: (message: string) => void;
  onOpenPerson?: (person: Person) => void;
  onOpenInitiative?: (initiative: Initiative) => void;
};

const ignoreToast = () => undefined;
const ignoreOpen = () => undefined;

type LinkTarget =
  | { kind: "person"; person: Person }
  | { kind: "initiative"; initiative: Initiative };

type ReminderSectionProps = {
  empty: string;
  headingId: string;
  items: BugunReminder[];
  loadFailed: boolean;
  loading: boolean;
  onComplete: (reminder: BugunReminder) => Promise<void>;
  onOpenReminder: (event: MouseEvent, reminder: BugunReminder) => void;
  title: string;
};

function ReminderSection({
  empty,
  headingId,
  items,
  loadFailed,
  loading,
  onComplete,
  onOpenReminder,
  title,
}: ReminderSectionProps) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {loading ? (
        <p>Hatırlatmalar yükleniyor…</p>
      ) : loadFailed ? (
        <p>Hatırlatmalar yüklenemedi.</p>
      ) : items.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className="reminder-list">
          {items.map((reminder) => (
            <li key={reminder.id}>
              <button
                className="reminder-list__open"
                onClick={(event) => onOpenReminder(event, reminder)}
                type="button"
              >
                <strong>{reminder.title}</strong>
                <time dateTime={reminder.dueAt}>
                  {new Date(reminder.dueAt).toLocaleString("tr-TR")}
                </time>
              </button>
              <button
                aria-label={`Tamamla: ${reminder.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void onComplete(reminder);
                }}
                type="button"
              >
                Tamamla
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function isNavigable(note: Note): boolean {
  return note.personIds.length > 0 || note.initiativeIds.length > 0;
}

function targetsFromNote(
  note: Note,
  peopleById: Map<number, Person>,
  initiativesById: Map<number, Initiative>,
): LinkTarget[] {
  const people = note.personIds
    .map((id) => peopleById.get(id))
    .filter((person): person is Person => Boolean(person))
    .map((person) => ({ kind: "person" as const, person }));
  const initiatives = note.initiativeIds
    .map((id) => initiativesById.get(id))
    .filter((initiative): initiative is Initiative => Boolean(initiative))
    .map((initiative) => ({ kind: "initiative" as const, initiative }));
  return [...people, ...initiatives];
}

export default function BugunView({
  db = getDb(),
  ticker,
  onToast = ignoreToast,
  onOpenPerson = ignoreOpen,
  onOpenInitiative = ignoreOpen,
}: BugunViewProps) {
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [peopleById, setPeopleById] = useState<Map<number, Person>>(
    () => new Map(),
  );
  const [initiativesById, setInitiativesById] = useState<
    Map<number, Initiative>
  >(() => new Map());
  const [linkMenu, setLinkMenu] = useState<{
    x: number;
    y: number;
    targets: LinkTarget[];
  } | null>(null);
  const linkMenuRef = useRef<HTMLDivElement | null>(null);
  const {
    completeReminder,
    loadFailed: remindersLoadFailed,
    loading: remindersLoading,
    permissionDenied,
    overdueReminders,
    reminders,
    upcomingReminders,
  } = ticker;

  const loadNotes = async () => {
    try {
      const [notes, people, initiatives] = await Promise.all([
        db.listActiveNotes(),
        db.listPeople(),
        db.listInitiatives(),
      ]);
      setRecentNotes(notes.slice(0, 10));
      setPeopleById(new Map(people.map((person) => [person.id, person])));
      setInitiativesById(
        new Map(initiatives.map((initiative) => [initiative.id, initiative])),
      );
    } catch {
      // Keep the panel usable even if notes fail.
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      db.listActiveNotes(),
      db.listPeople(),
      db.listInitiatives(),
    ])
      .then(([notes, people, initiatives]) => {
        if (!active) return;
        setRecentNotes(notes.slice(0, 10));
        setPeopleById(new Map(people.map((person) => [person.id, person])));
        setInitiativesById(
          new Map(initiatives.map((initiative) => [initiative.id, initiative])),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setNotesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [db]);

  useEffect(() => {
    if (!linkMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (linkMenuRef.current?.contains(event.target as Node)) return;
      setLinkMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLinkMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [linkMenu]);

  const archiveNote = async (noteId: number) => {
    try {
      await db.softDeleteNote(noteId, new Date().toISOString());
      onToast("Not arşivlendi");
      await loadNotes();
    } catch {
      onToast("Not arşivlenemedi");
    }
  };

  const showLinkMenu = (
    event: MouseEvent,
    targets: LinkTarget[],
  ) => {
    if (targets.length === 0) {
      onToast("Bağlantı bulunamadı");
      return;
    }
    setLinkMenu({ x: event.clientX, y: event.clientY, targets });
  };

  const openNoteLinkMenu = (event: MouseEvent, note: Note) => {
    if (!isNavigable(note)) return;
    showLinkMenu(event, targetsFromNote(note, peopleById, initiativesById));
  };

  const openReminderLinkMenu = async (
    event: MouseEvent,
    reminder: BugunReminder,
  ) => {
    if (reminder.targetType === "initiative") {
      const initiative = initiativesById.get(reminder.targetId);
      showLinkMenu(
        event,
        initiative ? [{ kind: "initiative", initiative }] : [],
      );
      return;
    }

    try {
      const note = await db.getNote(reminder.targetId);
      if (!note) {
        onToast("Bağlantı bulunamadı");
        return;
      }
      showLinkMenu(event, targetsFromNote(note, peopleById, initiativesById));
    } catch {
      onToast("Bağlantı bulunamadı");
    }
  };

  return (
    <section className="bugun-view">
      <h1>Bugün</h1>

      {permissionDenied ? (
        <p className="inline-banner" role="status">
          Bildirim izni yok; Bugün paneli çalışmaya devam eder
        </p>
      ) : null}

      <ReminderSection
        empty="Geciken hatırlatma yok."
        headingId="overdue-reminders-heading"
        items={overdueReminders}
        loadFailed={remindersLoadFailed}
        loading={remindersLoading}
        onComplete={completeReminder}
        onOpenReminder={(event, reminder) => {
          void openReminderLinkMenu(event, reminder);
        }}
        title="Gecikenler"
      />
      <ReminderSection
        empty="Bugün için hatırlatma yok."
        headingId="bugun-reminders-heading"
        items={reminders}
        loadFailed={remindersLoadFailed}
        loading={remindersLoading}
        onComplete={completeReminder}
        onOpenReminder={(event, reminder) => {
          void openReminderLinkMenu(event, reminder);
        }}
        title="Hatırlatmalar"
      />
      <ReminderSection
        empty="Yaklaşan hatırlatma yok."
        headingId="upcoming-reminders-heading"
        items={upcomingReminders}
        loadFailed={remindersLoadFailed}
        loading={remindersLoading}
        onComplete={completeReminder}
        onOpenReminder={(event, reminder) => {
          void openReminderLinkMenu(event, reminder);
        }}
        title="Yaklaşanlar"
      />

      <section aria-labelledby="recent-notes-heading">
        <h2 id="recent-notes-heading">Son notlar</h2>
        {notesLoading ? (
          <p>Notlar yükleniyor…</p>
        ) : recentNotes.length === 0 ? (
          <p>Henüz not yok.</p>
        ) : (
          <NoteArchiveShell enabled onArchive={archiveNote}>
            {({ openArchiveMenu }) => (
              <ul aria-label="Son notlar" className="recent-note-list">
                {recentNotes.map((note) => {
                  const navigable = isNavigable(note);
                  return (
                    <li
                      className={
                        navigable
                          ? "recent-note-list__item--navigable"
                          : undefined
                      }
                      key={note.id}
                      onClick={
                        navigable
                          ? (event) => openNoteLinkMenu(event, note)
                          : undefined
                      }
                      onContextMenu={(event) => openArchiveMenu(event, note)}
                    >
                      <p>{note.body}</p>
                      <NoteTimestamps note={note} />
                    </li>
                  );
                })}
              </ul>
            )}
          </NoteArchiveShell>
        )}
      </section>

      {linkMenu && linkMenu.targets.length > 0 ? (
        <div
          className="person-label-menu"
          ref={linkMenuRef}
          style={{ left: linkMenu.x, top: linkMenu.y }}
        >
          {linkMenu.targets.map((target) =>
            target.kind === "person" ? (
              <button
                key={`person-${target.person.id}`}
                onClick={() => {
                  onOpenPerson(target.person);
                  setLinkMenu(null);
                }}
                type="button"
              >
                {`Kişi: ${target.person.name}`}
              </button>
            ) : (
              <button
                key={`initiative-${target.initiative.id}`}
                onClick={() => {
                  onOpenInitiative(target.initiative);
                  setLinkMenu(null);
                }}
                type="button"
              >
                {`İş: ${target.initiative.name}`}
              </button>
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}
