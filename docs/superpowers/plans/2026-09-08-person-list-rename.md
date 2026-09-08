# Person List Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-click a person in Kişi listesi → **İsmi değiştir** → rename inline on the row.

**Architecture:** Extend `updatePerson` so patches can set `name` (trim + duplicate check like `createPerson`). In `PeopleView`, add a context-menu action that opens an inline input on that row (Enter/blur save, Esc cancel), then refresh list state from the returned `Person`.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, SQLite via `peopleRepo`.

## Global Constraints

- No new dependencies without asking the user.
- Turkish UI copy from the design doc: **İsmi değiştir**, toast **İsim boş olamaz**.
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-08-person-list-rename-design.md`
- Rename to another active person’s name must reject with **Bu isimde kayıt var** (same rule as `createPerson`; keep DB consistency even though the design marked “duplicate checks” out of product scope).

## File map

| File | Responsibility |
|------|----------------|
| `src/db/peopleRepo.ts` | `UpdatePersonPatch.name?`; `updatePerson` writes name |
| `src/views/PeopleView.tsx` | Menu item + inline rename UI + call `updatePerson` |
| `src/styles.css` | Compact inline rename input in entity list row |
| `tests/peopleRepo.test.ts` | Repo coverage for rename / empty / duplicate |
| `tests/people-rename-ui.test.tsx` | Context menu → inline rename UI |

---

### Task 1: `updatePerson` supports `name`

**Files:**
- Modify: `src/db/peopleRepo.ts`
- Modify: `tests/peopleRepo.test.ts`

**Interfaces:**
- Consumes: existing `UpdatePersonPatch`, `getPerson`, `findPersonByName`, `getPersonLabel`
- Produces: `UpdatePersonPatch = { labelId?: number | null; name?: string }`; `updatePerson` applies whichever fields are present

- [ ] **Step 1: Write the failing repo tests**

Append to `tests/peopleRepo.test.ts` (import `updatePerson` is already present):

```ts
it("renames a person", async () => {
  const db = openTestAsyncDb();
  const nowIso = "2026-09-08T10:00:00.000Z";
  const person = await createPerson(db, { name: "Ayşe", nowIso });

  const updated = await updatePerson(db, person.id, { name: "Ayşe Yılmaz" });
  expect(updated.name).toBe("Ayşe Yılmaz");
  expect(await getPerson(db, person.id)).toEqual(
    expect.objectContaining({ id: person.id, name: "Ayşe Yılmaz" }),
  );
  db.close();
});

it("rejects renaming to a duplicate active name", async () => {
  const db = openTestAsyncDb();
  const nowIso = "2026-09-08T10:00:00.000Z";
  await createPerson(db, { name: "Ayşe", nowIso });
  const other = await createPerson(db, { name: "Can", nowIso });

  await expect(
    updatePerson(db, other.id, { name: "ayşe" }),
  ).rejects.toThrow("Bu isimde kayıt var");
  db.close();
});

it("rejects empty rename", async () => {
  const db = openTestAsyncDb();
  const nowIso = "2026-09-08T10:00:00.000Z";
  const person = await createPerson(db, { name: "Ayşe", nowIso });

  await expect(updatePerson(db, person.id, { name: "   " })).rejects.toThrow(
    "İsim boş olamaz",
  );
  db.close();
});
```

Ensure `getPerson` is imported from `../src/db/peopleRepo` if not already.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/peopleRepo.test.ts`

Expected: FAIL on rename (name unchanged / patch ignored) or missing validation.

- [ ] **Step 3: Implement `updatePerson` name support**

In `src/db/peopleRepo.ts`:

1. Extend the type:

```ts
export type UpdatePersonPatch = {
  labelId?: number | null;
  name?: string;
};
```

2. Replace `updatePerson` so it applies present fields (keep label behavior; add name). Minimal shape:

```ts
export async function updatePerson(
  db: AsyncDb,
  id: number,
  patch: UpdatePersonPatch,
): Promise<Person> {
  const existing = await getPerson(db, id);
  if (!existing) {
    throw new Error("Kayıt bulunamadı");
  }

  const hasName = "name" in patch;
  const hasLabel = "labelId" in patch;
  if (!hasName && !hasLabel) {
    return existing;
  }

  let nextName = existing.name;
  if (hasName) {
    const trimmed = (patch.name ?? "").trim();
    if (!trimmed) {
      throw new Error("İsim boş olamaz");
    }
    const clash = await findPersonByName(db, trimmed);
    if (clash && clash.id !== id) {
      throw new Error("Bu isimde kayıt var");
    }
    nextName = trimmed;
  }

  let nextLabelId = existing.label?.id ?? null;
  if (hasLabel) {
    if (patch.labelId != null) {
      const label = await getPersonLabel(db, patch.labelId);
      if (!label) {
        throw new Error("Etiket bulunamadı");
      }
    }
    nextLabelId = patch.labelId ?? null;
  }

  await db.execute("UPDATE people SET name = ?, label_id = ? WHERE id = ?", [
    nextName,
    nextLabelId,
    id,
  ]);

  const person = await getPerson(db, id);
  if (!person) {
    throw new Error("Kayıt bulunamadı");
  }
  return person;
}
```

Do not change `AppDb` signatures beyond the existing `updatePerson(id, patch)` — the patch type is already re-exported / used from `peopleRepo`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/peopleRepo.test.ts`

Expected: PASS (including existing label + duplicate-create tests).

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/db/peopleRepo.ts tests/peopleRepo.test.ts
git commit -m "$(cat <<'EOF'
feat: allow updatePerson to rename people

EOF
)"
```

---

### Task 2: PeopleView context menu + inline rename

**Files:**
- Create: `tests/people-rename-ui.test.tsx`
- Modify: `src/views/PeopleView.tsx`
- Modify: `src/styles.css` (add `.entity-list__rename` near `.entity-list__open`)
- Modify: `tests/people-delete-ui.test.tsx` — add `updatePerson: vi.fn()` to db mocks if TypeScript / runtime needs it (Pick type will require it on `PeopleDb`)

**Interfaces:**
- Consumes: `AppDb.updatePerson(id, { name })` → `Promise<Person>`
- Produces: UI action **İsmi değiştir**; local `people` state updated after save

- [ ] **Step 1: Write the failing UI test**

Create `tests/people-rename-ui.test.tsx`:

```tsx
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { Person } from "../src/lib/types";
import PeopleView from "../src/views/PeopleView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: "Ürün lideri",
  createdAt: "2026-09-05T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

function mockDb(overrides: Partial<AppDb> = {}): AppDb {
  return {
    createPerson: vi.fn(),
    listPeople: vi.fn().mockResolvedValue([person]),
    reorderPeople: vi.fn(),
    archivePerson: vi.fn(),
    updatePerson: vi.fn(),
    listPersonLabels: vi.fn().mockResolvedValue([]),
    createPersonLabel: vi.fn(),
    updatePersonLabel: vi.fn(),
    deletePersonLabel: vi.fn(),
    ...overrides,
  } as unknown as AppDb;
}

describe("PeopleView rename", () => {
  it("renames a person from the context menu inline", async () => {
    const updatePerson = vi.fn().mockResolvedValue({
      ...person,
      name: "Ayşe Yılmaz",
    });
    const onToast = vi.fn();

    render(
      <PeopleView db={mockDb({ updatePerson })} onToast={onToast} />,
    );

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Ayşe" }));
    fireEvent.click(screen.getByRole("button", { name: "İsmi değiştir" }));

    const input = screen.getByRole("textbox", { name: "Kişi adını düzenle" });
    expect(input).toHaveProperty("value", "Ayşe");
    fireEvent.change(input, { target: { value: "Ayşe Yılmaz" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(updatePerson).toHaveBeenCalledWith(1, { name: "Ayşe Yılmaz" });
      expect(screen.getByRole("button", { name: "Ayşe Yılmaz" })).toBeTruthy();
    });
  });

  it("cancels rename with Escape without calling updatePerson", async () => {
    const updatePerson = vi.fn();
    render(<PeopleView db={mockDb({ updatePerson })} onToast={vi.fn()} />);

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Ayşe" }));
    fireEvent.click(screen.getByRole("button", { name: "İsmi değiştir" }));

    const input = screen.getByRole("textbox", { name: "Kişi adını düzenle" });
    fireEvent.change(input, { target: { value: "Başka" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(updatePerson).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ayşe" })).toBeTruthy();
  });

  it("toasts when rename draft is empty", async () => {
    const updatePerson = vi.fn();
    const onToast = vi.fn();
    render(<PeopleView db={mockDb({ updatePerson })} onToast={onToast} />);

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Ayşe" }));
    fireEvent.click(screen.getByRole("button", { name: "İsmi değiştir" }));

    const input = screen.getByRole("textbox", { name: "Kişi adını düzenle" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onToast).toHaveBeenCalledWith("İsim boş olamaz");
    expect(updatePerson).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Kişi adını düzenle" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run UI test to verify it fails**

Run: `npm test -- tests/people-rename-ui.test.tsx`

Expected: FAIL — no **İsmi değiştir** / no textbox.

- [ ] **Step 3: Wire `PeopleView`**

1. Add `"updatePerson"` to the `PeopleDb` Pick union.

2. State:

```ts
const [renamingId, setRenamingId] = useState<number | null>(null);
const [renameDraft, setRenameDraft] = useState("");
```

3. Helpers (reuse existing `namesMatch`):

```ts
const startRename = (personId: number) => {
  const target = people.find((person) => person.id === personId);
  if (!target) return;
  setMenu(null);
  setRenamingId(personId);
  setRenameDraft(target.name);
};

const cancelRename = () => {
  setRenamingId(null);
  setRenameDraft("");
};

const saveRename = async () => {
  if (renamingId === null) return;
  const current = people.find((person) => person.id === renamingId);
  if (!current) {
    cancelRename();
    return;
  }
  const trimmed = renameDraft.trim();
  if (!trimmed) {
    onToast("İsim boş olamaz");
    return;
  }
  if (namesMatch(trimmed, current.name)) {
    cancelRename();
    return;
  }
  try {
    const updated = await db.updatePerson(renamingId, { name: trimmed });
    setPeople((prev) =>
      prev.map((person) => (person.id === updated.id ? updated : person)),
    );
    cancelRename();
  } catch (error) {
    onToast(formatError(error) || "İsim güncellenemedi");
  }
};
```

4. Context menu — put rename **above** archive:

```tsx
<button
  onClick={() => startRename(menu.personId)}
  type="button"
>
  İsmi değiştir
</button>
<button
  className="person-label-menu__danger"
  onClick={() => {
    const target =
      people.find((person) => person.id === menu.personId) ?? null;
    setMenu(null);
    setPersonToDelete(target);
  }}
  type="button"
>
  Kişiyi arşivle
</button>
```

5. In the row, when `renamingId === person.id`, replace the open button’s heading name (or the whole open button content) with an input. Preferred: keep the row shell; swap the name `<strong>` / open button for:

```tsx
<input
  aria-label="Kişi adını düzenle"
  autoFocus
  className="entity-list__rename"
  onBlur={() => {
    void saveRename();
  }}
  onChange={(event) => setRenameDraft(event.target.value)}
  onClick={(event) => event.stopPropagation()}
  onKeyDown={(event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveRename();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  }}
  onPointerDown={(event) => event.stopPropagation()}
  value={renameDraft}
/>
```

Implementation detail: while renaming, render the input **instead of** the open `<button className="entity-list__open">` (still show drag handle). Keep label badge / role notes optional under the input if the open button currently shows them — simplest is input only in place of the open button for that row.

6. After adding `updatePerson` to `PeopleDb`, update `tests/people-delete-ui.test.tsx` mocks:

```ts
updatePerson: vi.fn(),
```

- [ ] **Step 4: Add CSS**

In `src/styles.css` after `.entity-list__open` rules:

```css
.entity-list__rename {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  margin: 0.35rem 0.75rem 0.35rem 0;
  padding: 0.55rem 0.75rem;
  border: 1px solid #c9d3df;
  border-radius: 0.5rem;
  background: #ffffff;
  color: inherit;
  font: inherit;
  font-weight: 600;
}
```

Adjust only if flex layout of `.entity-list__row` needs `display: flex` children to stretch — match existing row layout visually.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/peopleRepo.test.ts tests/people-rename-ui.test.tsx tests/people-delete-ui.test.tsx
```

Expected: all PASS.

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add src/views/PeopleView.tsx src/styles.css tests/people-rename-ui.test.tsx tests/people-delete-ui.test.tsx
git commit -m "$(cat <<'EOF'
feat: rename people from list context menu

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Menu **İsmi değiştir** above archive | Task 2 |
| Inline input, focus with current name | Task 2 |
| Enter / blur save, Esc cancel | Task 2 |
| Empty → toast **İsim boş olamaz** | Task 2 (+ repo Task 1) |
| Unchanged → no write | Task 2 (`namesMatch`) |
| List shows new name after save | Task 2 |
| `UpdatePersonPatch.name` + persist | Task 1 |
| Label-only updates still work | Task 1 (existing test) |
| Out of scope: role, label menu, initiative rename | Not implemented |
