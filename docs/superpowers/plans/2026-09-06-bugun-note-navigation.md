# Bugün Recent-Note Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Bugün → Son notlar, click a linked note to open a menu of people/initiatives and navigate to the chosen detail.

**Architecture:** Extend `BugunView` with `onOpenPerson` / `onOpenInitiative` and resolve names via `listPeople` + `listInitiatives`. Left-click navigable notes opens the existing `person-label-menu` listing all resolvable targets; `App` wires the same open handlers used elsewhere.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, existing AppDb.

## Global Constraints

- No new dependencies without asking the user.
- Turkish UI copy exactly as in the spec (`Kişi: …`, `İş: …`, `Bağlantı bulunamadı`).
- Do not use `window.confirm`.
- Commit + push when the feature is complete (user requested).
- Spec: `docs/superpowers/specs/2026-09-06-bugun-note-navigation-design.md`

## File map

| File | Responsibility |
|------|----------------|
| `src/views/BugunView.tsx` | Click menu + navigation for Son notlar |
| `src/App.tsx` | Pass `onOpenPerson` / `onOpenInitiative` into `BugunView` |
| `src/styles.css` | Navigable recent-note affordance |
| `tests/bugun-note-navigation-ui.test.tsx` | Linked / unlinked click behavior |
| `tests/task14-ui.test.tsx` | Keep harness compiling if props become required |

---

### Task 1: Son notlar click → link menu → navigate

**Files:**
- Create: `tests/bugun-note-navigation-ui.test.tsx`
- Modify: `src/views/BugunView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `tests/task14-ui.test.tsx` (only if needed for new props / db methods)

**Interfaces:**
- Consumes: `Note.personIds`, `Note.initiativeIds`; `AppDb.listPeople`, `AppDb.listInitiatives`, `AppDb.listActiveNotes`, `AppDb.softDeleteNote`
- Produces:
  - `BugunViewProps.onOpenPerson?: (person: Person) => void`
  - `BugunViewProps.onOpenInitiative?: (initiative: Initiative) => void`
  - Menu labels: `Kişi: ${name}`, `İş: ${name}`
  - Empty-resolve toast: `Bağlantı bulunamadı`

- [ ] **Step 1: Write the failing UI tests**

Create `tests/bugun-note-navigation-ui.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReminderTicker } from "../src/hooks/useReminderTicker";
import type { Initiative, Note, Person } from "../src/lib/types";
import BugunView from "../src/views/BugunView";

afterEach(() => cleanup());

const ticker: ReminderTicker = {
  completeReminder: vi.fn(),
  loadFailed: false,
  loading: false,
  permissionDenied: false,
  overdueReminders: [],
  reminders: [],
  upcomingReminders: [],
};

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: null,
  createdAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const initiative: Initiative = {
  id: 2,
  name: "Lansman",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-05T09:00:00.000Z",
  lastActivityAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
};

function makeNote(partial: Partial<Note> & Pick<Note, "id" | "body">): Note {
  return {
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
    deletedAt: null,
    tags: [],
    personIds: [],
    initiativeIds: [],
    topicIds: [],
    nextReminderDueAt: null,
    ...partial,
  };
}

describe("Bugün recent-note navigation", () => {
  it("opens a menu of people and initiatives and navigates on choose", async () => {
    const onOpenPerson = vi.fn();
    const onOpenInitiative = vi.fn();
    const linked = makeNote({
      id: 10,
      body: "Bağlı not",
      personIds: [person.id],
      initiativeIds: [initiative.id],
    });

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([linked]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([person]),
          listInitiatives: vi.fn().mockResolvedValue([initiative]),
        }}
        onOpenInitiative={onOpenInitiative}
        onOpenPerson={onOpenPerson}
        onToast={vi.fn()}
        ticker={ticker}
      />,
    );

    fireEvent.click(await screen.findByText("Bağlı not"));
    expect(await screen.findByRole("button", { name: "Kişi: Ayşe" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "İş: Lansman" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Kişi: Ayşe" }));
    expect(onOpenPerson).toHaveBeenCalledWith(person);

    fireEvent.click(await screen.findByText("Bağlı not"));
    fireEvent.click(await screen.findByRole("button", { name: "İş: Lansman" }));
    expect(onOpenInitiative).toHaveBeenCalledWith(initiative);
  });

  it("does not open a menu for unlinked notes", async () => {
    const onOpenPerson = vi.fn();
    const onOpenInitiative = vi.fn();
    const unlinked = makeNote({ id: 11, body: "Bağlantısız not" });

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([unlinked]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([person]),
          listInitiatives: vi.fn().mockResolvedValue([initiative]),
        }}
        onOpenInitiative={onOpenInitiative}
        onOpenPerson={onOpenPerson}
        onToast={vi.fn()}
        ticker={ticker}
      />,
    );

    fireEvent.click(await screen.findByText("Bağlantısız not"));
    expect(screen.queryByRole("button", { name: /Kişi:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /İş:/ })).toBeNull();
    expect(onOpenPerson).not.toHaveBeenCalled();
    expect(onOpenInitiative).not.toHaveBeenCalled();
  });

  it("toasts when linked ids cannot be resolved", async () => {
    const onToast = vi.fn();
    const linked = makeNote({
      id: 12,
      body: "Ölü bağlantı",
      personIds: [99],
      initiativeIds: [88],
    });

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([linked]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([]),
          listInitiatives: vi.fn().mockResolvedValue([]),
        }}
        onOpenInitiative={vi.fn()}
        onOpenPerson={vi.fn()}
        onToast={onToast}
        ticker={ticker}
      />,
    );

    fireEvent.click(await screen.findByText("Ölü bağlantı"));
    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Bağlantı bulunamadı");
    });
  });
});
```

Check `ReminderTicker` export shape in `src/hooks/useReminderTicker.ts` and adjust the stub if field names differ (include only what `BugunView` reads).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bugun-note-navigation-ui.test.tsx`

Expected: FAIL (missing props / no menu)

- [ ] **Step 3: Implement `BugunView` navigation**

Update types:

```ts
type BugunDb = Pick<
  AppDb,
  | "listActiveNotes"
  | "softDeleteNote"
  | "listPeople"
  | "listInitiatives"
>;

type BugunViewProps = {
  db?: BugunDb;
  ticker: ReminderTicker;
  onToast?: (message: string) => void;
  onOpenPerson?: (person: Person) => void;
  onOpenInitiative?: (initiative: Initiative) => void;
};
```

Load catalogs once with notes (or on first menu open). Suggested state:

```ts
const [peopleById, setPeopleById] = useState<Map<number, Person>>(new Map());
const [initiativesById, setInitiativesById] = useState<Map<number, Initiative>>(
  new Map(),
);
const [linkMenu, setLinkMenu] = useState<{
  noteId: number;
  x: number;
  y: number;
} | null>(null);
```

On mount / with `db`:

```ts
Promise.all([
  db.listActiveNotes(),
  db.listPeople(),
  db.listInitiatives(),
]).then(([notes, people, initiatives]) => {
  setRecentNotes(notes.slice(0, 10));
  setPeopleById(new Map(people.map((p) => [p.id, p])));
  setInitiativesById(new Map(initiatives.map((i) => [i.id, i])));
});
```

Click handler on a note row:

```ts
const isNavigable =
  note.personIds.length > 0 || note.initiativeIds.length > 0;

const openLinkMenu = (event: MouseEvent, note: Note) => {
  if (!isNavigable) return;
  const targets = [
    ...note.personIds
      .map((id) => peopleById.get(id))
      .filter(Boolean)
      .map((p) => ({ kind: "person" as const, person: p! })),
    ...note.initiativeIds
      .map((id) => initiativesById.get(id))
      .filter(Boolean)
      .map((i) => ({ kind: "initiative" as const, initiative: i! })),
  ];
  if (targets.length === 0) {
    onToast("Bağlantı bulunamadı");
    return;
  }
  setLinkMenu({ noteId: note.id, x: event.clientX, y: event.clientY });
};
```

Render: for navigable notes, wrap body in a clickable control (button or `li` with `onClick` + `className="recent-note-list__item--navigable"`). Keep `onContextMenu` for archive.

Menu (when `linkMenu` set), reuse `person-label-menu`:

```tsx
{linkMenu ? (
  <div
    className="person-label-menu"
    style={{ left: linkMenu.x, top: linkMenu.y }}
  >
    {targetsFor(linkMenu.noteId).map(...)}
  </div>
) : null}
```

Each person button: `Kişi: ${name}` → `onOpenPerson(person); setLinkMenu(null)`.  
Each initiative button: `İş: ${name}` → `onOpenInitiative(initiative); setLinkMenu(null)`.

Close menu on outside click / Escape if the codebase already does that for similar menus; otherwise match PeopleView menu dismiss pattern.

- [ ] **Step 4: Wire `App.tsx`**

```tsx
case "bugun":
  return (
    <BugunView
      db={appDb}
      onOpenInitiative={openInitiative}
      onOpenPerson={openPerson}
      onToast={showToast}
      ticker={reminderTicker}
    />
  );
```

- [ ] **Step 5: CSS affordance**

In `src/styles.css`:

```css
.recent-note-list__item--navigable {
  cursor: pointer;
}

.recent-note-list__item--navigable:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
```

Apply the class only when the note is navigable.

- [ ] **Step 6: Fix `task14-ui` if needed**

If `BugunHarness` / db mocks must include `listPeople` / `listInitiatives`, add:

```ts
listPeople: vi.fn().mockResolvedValue([]),
listInitiatives: vi.fn().mockResolvedValue([]),
```

`onOpenPerson` / `onOpenInitiative` may remain optional with no-op defaults so existing harness keeps working.

- [ ] **Step 7: Run tests**

```bash
npx vitest run tests/bugun-note-navigation-ui.test.tsx tests/task14-ui.test.tsx
npm test
```

Expected: all PASS

- [ ] **Step 8: Commit and push** (user requested when feature complete)

```bash
git add docs/superpowers/plans/2026-09-06-bugun-note-navigation.md \
  src/views/BugunView.tsx src/App.tsx src/styles.css \
  tests/bugun-note-navigation-ui.test.tsx tests/task14-ui.test.tsx
git commit -m "$(cat <<'EOF'
Navigate from Bugün recent notes to linked people and initiatives.

Open a target menu on click so Son notlar jump to the chosen detail view.
EOF
)"
git push -u origin HEAD
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Always show full menu of links | Task 1 |
| `Kişi:` / `İş:` labels + App open handlers | Task 1 |
| Unlinked not clickable | Task 1 |
| Archive context menu unchanged | Task 1 |
| Unresolvable → `Bağlantı bulunamadı` | Task 1 |
| Reminders out of scope | — |
| listPeople / listInitiatives resolve names | Task 1 |

## Self-review notes

- Single task is appropriate; behavior is one UI surface.
- If `lastActivityAt` is not yet on `Initiative` in the working tree when implementing, omit it from fixtures only if the type does not include it yet — match current `src/lib/types.ts`.
