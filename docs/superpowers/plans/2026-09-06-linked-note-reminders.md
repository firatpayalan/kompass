# Linked-Note Edit Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add an optional reminder when editing a note inside `LinkedNotes` (person/initiative detail), matching Notlar save behavior.

**Architecture:** Reuse `ReminderForm` in the LinkedNotes edit panel. Extend `onUpdateNote` to accept `ReminderDraft | null`. Parents (`PersonDetailView`, `InitiativeDetailView`) call `updateNote` then optionally `createReminder` with `targetType: "note"`. Empty-dueAt validation happens in LinkedNotes before calling the parent (toast only, no save).

**Tech Stack:** React + TypeScript, Vitest + Testing Library, existing `reminders` table / `createReminder`.

## Global Constraints

- No new dependencies without asking the user.
- Turkish copy exactly: **Hatırlatma ekle**, **Hatırlatma zamanı gerekli**, **Not kaydedildi, hatırlatma eklenemedi**, **Not güncellendi** (existing success toast OK).
- Do not use `window.confirm`.
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-06-linked-note-reminders-design.md`
- Out of scope: list/edit existing reminders; topic “Not ekle” compose form; Notlar / Quick Note changes; schema changes.

## File map

| File | Responsibility |
|------|----------------|
| `src/components/LinkedNotes.tsx` | ReminderForm in edit UI; validate dueAt; pass reminder to `onUpdateNote` |
| `src/views/PersonDetailView.tsx` | `createReminder` on db pick; reminder branch in `updateNote` |
| `src/views/InitiativeDetailView.tsx` | Same reminder branch in `updateNote` (already has `createReminder` for initiative form) |
| `tests/linked-note-reminders-ui.test.tsx` | LinkedNotes + PersonDetailView coverage |

---

### Task 1: LinkedNotes ReminderForm + parent save wiring

**Files:**
- Modify: `src/components/LinkedNotes.tsx`
- Modify: `src/views/PersonDetailView.tsx`
- Modify: `src/views/InitiativeDetailView.tsx`
- Create: `tests/linked-note-reminders-ui.test.tsx`

**Interfaces:**
- Consumes: `ReminderForm`, `ReminderDraft` from `src/components/ReminderForm.tsx`; `AppDb.createReminder` / `updateNote`
- Produces:
  - `onUpdateNote?: (noteId: number, body: string, reminder: ReminderDraft | null) => Promise<void>`
  - Parent creates reminder only when `reminder !== null`

- [ ] **Step 1: Write the failing UI tests**

Create `tests/linked-note-reminders-ui.test.tsx`:

```tsx
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { Note, Person } from "../src/lib/types";
import PersonDetailView from "../src/views/PersonDetailView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: null,
  createdAt: "2026-09-06T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const note: Note = {
  id: 20,
  body: "Pazartesi gunu one-pager deadline",
  createdAt: "2026-09-06T10:00:00.000Z",
  updatedAt: "2026-09-06T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [1],
  initiativeIds: [],
  topicIds: [],
};

function baseDb(overrides: Partial<AppDb> = {}) {
  return {
    createNote: vi.fn(),
    createTopic: vi.fn(),
    createReminder: vi.fn().mockResolvedValue({ id: 1 }),
    listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
      topics: [],
      untopicNotes: [note],
    }),
    updateNote: vi.fn().mockResolvedValue(note),
    softDeleteNote: vi.fn(),
    updateTopic: vi.fn(),
    updatePerson: vi.fn(),
    listPersonLabels: vi.fn().mockResolvedValue([]),
    createPersonLabel: vi.fn(),
    updatePersonLabel: vi.fn(),
    deletePersonLabel: vi.fn(),
    addTagToTopic: vi.fn(),
    linkTagToTopic: vi.fn(),
    listTopicTags: vi.fn().mockResolvedValue([]),
    updateTopicTag: vi.fn(),
    deleteTopicTag: vi.fn(),
    addTagToNote: vi.fn(),
    linkTagToNote: vi.fn(),
    listNoteTags: vi.fn().mockResolvedValue([]),
    updateNoteTag: vi.fn(),
    deleteNoteTag: vi.fn(),
    linkNoteToTopics: vi.fn(),
    ...overrides,
  } as unknown as AppDb;
}

describe("linked note edit reminders", () => {
  it("creates a note reminder when saving with due time", async () => {
    const createReminder = vi.fn().mockResolvedValue({ id: 9 });
    const updateNote = vi.fn().mockResolvedValue(note);
    const onToast = vi.fn();

    render(
      <PersonDetailView
        db={baseDb({ createReminder, updateNote })}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
      />,
    );

    const list = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(list).getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByLabelText("Hatırlatma ekle"));
    fireEvent.change(screen.getByLabelText("Hatırlatma zamanı"), {
      target: { value: "2026-09-08T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith(note.id, note.body);
      expect(createReminder).toHaveBeenCalledWith({
        targetType: "note",
        targetId: note.id,
        dueAt: expect.any(String),
        period: "once",
        nowIso: expect.any(String),
      });
    });
    expect(new Date(createReminder.mock.calls[0][0].dueAt).toISOString()).toBe(
      new Date("2026-09-08T09:00").toISOString(),
    );
  });

  it("blocks save when reminder is enabled without due time", async () => {
    const createReminder = vi.fn();
    const updateNote = vi.fn();
    const onToast = vi.fn();

    render(
      <PersonDetailView
        db={baseDb({ createReminder, updateNote })}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
      />,
    );

    const list = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(list).getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByLabelText("Hatırlatma ekle"));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Hatırlatma zamanı gerekli");
    });
    expect(updateNote).not.toHaveBeenCalled();
    expect(createReminder).not.toHaveBeenCalled();
  });

  it("updates the note only when reminder is off", async () => {
    const createReminder = vi.fn();
    const updateNote = vi.fn().mockResolvedValue(note);

    render(
      <PersonDetailView
        db={baseDb({ createReminder, updateNote })}
        onBack={vi.fn()}
        onToast={vi.fn()}
        person={person}
      />,
    );

    const list = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(list).getByRole("button", { name: "Düzenle" }));
    fireEvent.change(screen.getByLabelText("Notu düzenle"), {
      target: { value: "Guncellenmis not" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith(note.id, "Guncellenmis not");
    });
    expect(createReminder).not.toHaveBeenCalled();
  });
});
```

If `getByLabelText("Hatırlatma ekle")` fails because the checkbox label wraps oddly, use the same query pattern as existing ReminderForm tests (search `Hatırlatma ekle` in `tests/`).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/linked-note-reminders-ui.test.tsx`

Expected: FAIL (no ReminderForm / createReminder wiring)

- [ ] **Step 3: Update LinkedNotes**

In `src/components/LinkedNotes.tsx`:

1. Import `ReminderForm`, `ReminderDraft`, `ReminderPeriod`.
2. Change prop type:

```ts
onUpdateNote?: (
  noteId: number,
  body: string,
  reminder: ReminderDraft | null,
) => Promise<void>;
```

3. Add edit-local state (reset on startEdit / Vazgeç):

```ts
const [reminderEnabled, setReminderEnabled] = useState(false);
const [dueAt, setDueAt] = useState("");
const [period, setPeriod] = useState<ReminderPeriod>("once");
```

In `startEdit`, also reset reminder fields to defaults (`false`, `""`, `"once"`).

4. Replace `saveEdit`:

```ts
const saveEdit = async () => {
  if (editingId === null || !onUpdateNote) return;
  if (reminderEnabled && !dueAt) {
    onToast("Hatırlatma zamanı gerekli");
    return;
  }
  setSaving(true);
  try {
    await onUpdateNote(
      editingId,
      draft,
      reminderEnabled ? { dueAt, period } : null,
    );
    setEditingId(null);
    setReminderEnabled(false);
    setDueAt("");
    setPeriod("once");
  } finally {
    setSaving(false);
  }
};
```

5. In the edit panel, between textarea and actions, render:

```tsx
<ReminderForm
  dueAt={dueAt}
  enabled={reminderEnabled}
  onDueAtChange={setDueAt}
  onEnabledChange={setReminderEnabled}
  onPeriodChange={setPeriod}
  period={period}
/>
```

6. Vazgeç button should clear reminder state when leaving edit (same resets as after successful save).

- [ ] **Step 4: Wire PersonDetailView**

1. Add `"createReminder"` to `PersonDetailDb` Pick.
2. Replace `updateNote`:

```ts
const updateNote = async (
  noteId: number,
  body: string,
  reminder: ReminderDraft | null = null,
) => {
  if (!body.trim()) {
    onToast("Not boş olamaz");
    throw new Error("Not boş olamaz");
  }
  try {
    await db.updateNote(noteId, body);
  } catch {
    onToast("Not güncellenemedi");
    throw new Error("Not güncellenemedi");
  }

  let reminderFailed = false;
  if (reminder) {
    try {
      await db.createReminder({
        targetType: "note",
        targetId: noteId,
        dueAt: new Date(reminder.dueAt).toISOString(),
        period: reminder.period,
        nowIso: new Date().toISOString(),
      });
    } catch {
      reminderFailed = true;
    }
  }

  await load();
  if (reminderFailed) {
    onToast("Not kaydedildi, hatırlatma eklenemedi");
  } else {
    onToast("Not güncellendi");
  }
};
```

Import `ReminderDraft` from `../components/ReminderForm`.

- [ ] **Step 5: Wire InitiativeDetailView**

Same `updateNote` signature and reminder branch as PersonDetailView (reuse the same structure). `createReminder` is already on the db pick — do not remove initiative-level ReminderForm; only extend note update.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run tests/linked-note-reminders-ui.test.tsx`

Expected: PASS

- [ ] **Step 7: Full suite**

Run: `npm test`

Expected: all PASS. Fix any callers of `onUpdateNote` / `updateNote` that break TypeScript (ArchiveView should be fine if it omits `onUpdateNote`).

- [ ] **Step 8: Commit (only if user asked)**

```bash
git add src/components/LinkedNotes.tsx src/views/PersonDetailView.tsx src/views/InitiativeDetailView.tsx tests/linked-note-reminders-ui.test.tsx
git commit -m "$(cat <<'EOF'
Allow adding reminders when editing linked notes.

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| ReminderForm in LinkedNotes edit | Task 1 |
| Empty dueAt → toast, no save | Task 1 (LinkedNotes) |
| createReminder targetType note | Task 1 (parents) |
| Reminder fail toast after note save | Task 1 (parents) |
| Vazgeç clears draft | Task 1 |
| Out of scope items | Not implemented |
| Tests for three cases | Task 1 |
