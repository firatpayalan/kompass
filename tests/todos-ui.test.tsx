/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import type { AppDb } from "../src/db/appDb";
import Sidebar from "../src/components/Sidebar";
import type { Initiative, TodoListItem, TodoStatus } from "../src/lib/types";
import TodosView from "../src/views/TodosView";
import PersonDetailView from "../src/views/PersonDetailView";
import NotesView from "../src/views/NotesView";
import InboxView from "../src/views/InboxView";
import type { Note, Person } from "../src/lib/types";

afterEach(() => cleanup());

const statuses: TodoStatus[] = [
  {
    id: 1,
    name: "açık",
    color: "sky",
    countsAsComplete: false,
    sortOrder: 0,
    isBuiltin: true,
    createdAt: "2026-09-05T00:00:00.000Z",
  },
  {
    id: 3,
    name: "tamamlandı",
    color: "lime",
    countsAsComplete: true,
    sortOrder: 2,
    isBuiltin: true,
    createdAt: "2026-09-05T00:00:00.000Z",
  },
  {
    id: 7,
    name: "bekliyor",
    color: "amber",
    countsAsComplete: false,
    sortOrder: 3,
    isBuiltin: false,
    createdAt: "2026-09-05T00:00:00.000Z",
  },
];

function makeTodo(partial: Partial<TodoListItem> = {}): TodoListItem {
  return {
    id: 1,
    title: "RFC yaz",
    noteId: 9,
    statusId: 1,
    statusName: "açık",
    statusColor: "sky",
    countsAsComplete: false,
    createdAt: "2026-10-02T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    completedAt: null,
    noteDeletedAt: null,
    initiativeIds: [2],
    personIds: [],
    ...partial,
  };
}

function makeInitiative(id: number, name: string): Initiative {
  return {
    id,
    name,
    status: "aktif",
    blockerSummary: null,
    createdAt: "2026-09-05T09:00:00.000Z",
    lastActivityAt: "2026-09-05T09:00:00.000Z",
    sortOrder: 0,
    archivedAt: null,
    tags: [],
  };
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    listTodos: vi.fn().mockResolvedValue([makeTodo()]),
    listTodoStatuses: vi.fn().mockResolvedValue(statuses),
    updateTodoStatus: vi.fn().mockResolvedValue({}),
    createTodoStatus: vi.fn().mockResolvedValue(statuses[2]),
    deleteTodoStatus: vi.fn().mockResolvedValue(undefined),
    listInitiatives: vi
      .fn()
      .mockResolvedValue([makeInitiative(2, "Lansman"), makeInitiative(5, "Göç")]),
    ...overrides,
  };
}

describe("TodosView", () => {
  it("lists todos and updates status for a single-initiative note", async () => {
    const db = makeDb();
    render(<TodosView db={db} onOpenNote={vi.fn()} onToast={vi.fn()} />);

    expect(await screen.findByText("RFC yaz")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("RFC yaz durumu"), {
      target: { value: "3" },
    });

    await waitFor(() =>
      expect(db.updateTodoStatus).toHaveBeenCalledWith(1, 3, undefined),
    );
  });

  it("maps filter chips to listTodos completion filter", async () => {
    const db = makeDb();
    render(<TodosView db={db} onOpenNote={vi.fn()} onToast={vi.fn()} />);
    await screen.findByText("RFC yaz");
    expect(db.listTodos).toHaveBeenLastCalledWith({ completion: "all" });

    fireEvent.click(screen.getByRole("button", { name: "Açık" }));
    await waitFor(() =>
      expect(db.listTodos).toHaveBeenLastCalledWith({ completion: "open" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tamamlananlar" }));
    await waitFor(() =>
      expect(db.listTodos).toHaveBeenLastCalledWith({ completion: "done" }),
    );
  });

  it("opens the initiative picker on İş seçimi gerekli and retries with the choice", async () => {
    const db = makeDb({
      listTodos: vi
        .fn()
        .mockResolvedValue([makeTodo({ initiativeIds: [2, 5] })]),
      updateTodoStatus: vi
        .fn()
        .mockRejectedValueOnce(new Error("İş seçimi gerekli"))
        .mockResolvedValueOnce({}),
    });
    const onToast = vi.fn();
    render(<TodosView db={db} onOpenNote={vi.fn()} onToast={onToast} />);
    await screen.findByText("RFC yaz");

    fireEvent.change(screen.getByLabelText("RFC yaz durumu"), {
      target: { value: "3" },
    });

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Göç"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Onayla" }));

    await waitFor(() =>
      expect(db.updateTodoStatus).toHaveBeenLastCalledWith(1, 3, {
        initiativeId: 5,
      }),
    );
    expect(db.updateTodoStatus).toHaveBeenCalledTimes(2);
    expect(onToast).not.toHaveBeenCalledWith("İş seçimi gerekli");
  });

  it("does not update when the initiative picker is cancelled", async () => {
    const db = makeDb({
      listTodos: vi
        .fn()
        .mockResolvedValue([makeTodo({ initiativeIds: [2, 5] })]),
      updateTodoStatus: vi
        .fn()
        .mockRejectedValueOnce(new Error("İş seçimi gerekli")),
    });
    render(<TodosView db={db} onOpenNote={vi.fn()} onToast={vi.fn()} />);
    await screen.findByText("RFC yaz");

    fireEvent.change(screen.getByLabelText("RFC yaz durumu"), {
      target: { value: "3" },
    });
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Vazgeç" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(db.updateTodoStatus).toHaveBeenCalledTimes(1);
  });

  it("toasts when completing a todo with no linked initiative", async () => {
    const db = makeDb({
      listTodos: vi.fn().mockResolvedValue([makeTodo({ initiativeIds: [] })]),
    });
    const onToast = vi.fn();
    render(<TodosView db={db} onOpenNote={vi.fn()} onToast={onToast} />);
    await screen.findByText("RFC yaz");

    fireEvent.change(screen.getByLabelText("RFC yaz durumu"), {
      target: { value: "3" },
    });

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(
        "Bağlı iş yok; durum kaydedildi, işe not yazılmadı",
      ),
    );
  });

  it("does not show the no-initiative toast for non-completing statuses", async () => {
    const db = makeDb({
      listTodos: vi.fn().mockResolvedValue([makeTodo({ initiativeIds: [] })]),
    });
    const onToast = vi.fn();
    render(<TodosView db={db} onOpenNote={vi.fn()} onToast={onToast} />);
    await screen.findByText("RFC yaz");

    fireEvent.change(screen.getByLabelText("RFC yaz durumu"), {
      target: { value: "7" },
    });

    await waitFor(() => expect(db.updateTodoStatus).toHaveBeenCalled());
    expect(onToast).not.toHaveBeenCalled();
  });

  it("opens the source note via Nota git", async () => {
    const onOpenNote = vi.fn();
    render(
      <TodosView db={makeDb()} onOpenNote={onOpenNote} onToast={vi.fn()} />,
    );
    await screen.findByText("RFC yaz");
    fireEvent.click(screen.getByRole("button", { name: "Nota git" }));
    expect(onOpenNote).toHaveBeenCalledWith(9);
  });

  it("adds and deletes custom statuses", async () => {
    const db = makeDb();
    const onToast = vi.fn();
    render(<TodosView db={db} onOpenNote={vi.fn()} onToast={onToast} />);
    await screen.findByText("RFC yaz");

    fireEvent.change(screen.getByLabelText("Durum adı"), {
      target: { value: "incelemede" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Renk: rose" }));
    fireEvent.click(screen.getByLabelText("Tamamlandı say"));
    fireEvent.click(screen.getByRole("button", { name: "Durum ekle" }));

    await waitFor(() =>
      expect(db.createTodoStatus).toHaveBeenCalledWith({
        name: "incelemede",
        color: "rose",
        countsAsComplete: true,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "bekliyor sil" }));
    await waitFor(() => expect(db.deleteTodoStatus).toHaveBeenCalledWith(7));
    expect(screen.queryByRole("button", { name: "açık sil" })).toBeNull();
  });
});

describe("Sidebar Yapılacaklar", () => {
  it("shows Yapılacaklar after Notlar and navigates to yapilacaklar", () => {
    const onViewChange = vi.fn();
    render(
      <Sidebar activeView="bugun" onViewChange={onViewChange} version="0.3.0" />,
    );
    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels.indexOf("Yapılacaklar")).toBe(labels.indexOf("Notlar") + 1);

    fireEvent.click(screen.getByRole("button", { name: "Yapılacaklar" }));
    expect(onViewChange).toHaveBeenCalledWith("yapilacaklar");
  });
});

describe("App Nota git routing", () => {
  function appDb(overrides: Record<string, unknown>): AppDb {
    const fns = new Map<string | symbol, unknown>(Object.entries(overrides));
    return new Proxy({} as AppDb, {
      get(_target, key) {
        if (!fns.has(key)) {
          fns.set(key, vi.fn().mockResolvedValue([]));
        }
        return fns.get(key);
      },
    });
  }

  it("toasts Kaynak not arşivde when the source note is archived", async () => {
    const db = appDb({
      listTodos: vi.fn().mockResolvedValue([makeTodo()]),
      listTodoStatuses: vi.fn().mockResolvedValue(statuses),
      getNote: vi.fn().mockResolvedValue(null),
    });
    render(
      <App
        db={db}
        notify={vi.fn().mockResolvedValue(true)}
        now={() => new Date("2026-10-02T10:00:00.000Z")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Yapılacaklar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nota git" }));

    expect(await screen.findByText("Kaynak not arşivde")).toBeTruthy();
  });
});

const noteForTodo: Note = {
  id: 20,
  body: "faruk ile RFC konus",
  createdAt: "2026-10-02T10:00:00.000Z",
  updatedAt: "2026-10-02T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [1],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
};

const personForTodo: Person = {
  id: 1,
  name: "tayfun",
  roleOrNotes: null,
  createdAt: "2026-09-06T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

describe("To-do yap on note surfaces", () => {
  function personDb(overrides: Record<string, unknown> = {}) {
    return {
      listTopicsWithNotesForPerson: vi
        .fn()
        .mockResolvedValue({ topics: [], untopicNotes: [noteForTodo] }),
      listPersonLabels: vi.fn().mockResolvedValue([]),
      listTopicTags: vi.fn().mockResolvedValue([]),
      listNoteTags: vi.fn().mockResolvedValue([]),
      getNoteImage: vi.fn().mockResolvedValue(null),
      saveNoteImage: vi.fn(),
      ...overrides,
    } as unknown as AppDb;
  }

  it("creates a todo from a linked note", async () => {
    const createTodoFromNote = vi.fn().mockResolvedValue({ id: 1 });
    const onToast = vi.fn();
    render(
      <PersonDetailView
        db={personDb({ createTodoFromNote })}
        onBack={vi.fn()}
        onToast={onToast}
        person={personForTodo}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "To-do yap" }));

    await waitFor(() => {
      expect(createTodoFromNote).toHaveBeenCalledWith(noteForTodo.id);
      expect(onToast).toHaveBeenCalledWith("Yapılacaklara eklendi");
    });
  });

  it("surfaces the duplicate error message", async () => {
    const createTodoFromNote = vi
      .fn()
      .mockRejectedValue(new Error("Bu not zaten bir to-do"));
    const onToast = vi.fn();
    render(
      <PersonDetailView
        db={personDb({ createTodoFromNote })}
        onBack={vi.fn()}
        onToast={onToast}
        person={personForTodo}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "To-do yap" }));

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith("Bu not zaten bir to-do"),
    );
  });

  it("creates a todo from NotesView", async () => {
    const createTodoFromNote = vi.fn().mockResolvedValue({ id: 1 });
    const onToast = vi.fn();
    const db = {
      listActiveNotes: vi.fn().mockResolvedValue([noteForTodo]),
      listNoteTags: vi.fn().mockResolvedValue([]),
      listPeople: vi.fn().mockResolvedValue([personForTodo]),
      listInitiatives: vi.fn().mockResolvedValue([]),
      getNoteImage: vi.fn().mockResolvedValue(null),
      saveNoteImage: vi.fn(),
      createTodoFromNote,
    } as unknown as AppDb;
    render(<NotesView db={db} onToast={onToast} />);

    fireEvent.click(await screen.findByRole("button", { name: "To-do yap" }));

    await waitFor(() => {
      expect(createTodoFromNote).toHaveBeenCalledWith(noteForTodo.id);
      expect(onToast).toHaveBeenCalledWith("Yapılacaklara eklendi");
    });
  });

  it("creates a todo from InboxView", async () => {
    const createTodoFromNote = vi.fn().mockResolvedValue({ id: 1 });
    const onToast = vi.fn();
    const db = {
      listInboxNotes: vi.fn().mockResolvedValue([noteForTodo]),
      listPeople: vi.fn().mockResolvedValue([]),
      listInitiatives: vi.fn().mockResolvedValue([]),
      getNoteImage: vi.fn().mockResolvedValue(null),
      saveNoteImage: vi.fn(),
      createTodoFromNote,
    } as unknown as AppDb;
    render(<InboxView db={db} onToast={onToast} />);

    fireEvent.click(await screen.findByRole("button", { name: "To-do yap" }));

    await waitFor(() => {
      expect(createTodoFromNote).toHaveBeenCalledWith(noteForTodo.id);
      expect(onToast).toHaveBeenCalledWith("Yapılacaklara eklendi");
    });
  });
});
