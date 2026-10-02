import { useCallback, useEffect, useState } from "react";
import TodoInitiativePicker, {
  type TodoInitiativeOption,
} from "../components/TodoInitiativePicker";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import { formatError } from "../lib/formatError";
import { formatRelativeTr } from "../lib/formatRelativeTr";
import { PERSON_LABEL_COLORS } from "../lib/personLabels";
import type { TodoListItem, TodoStatus } from "../lib/types";

type TodosDb = Pick<
  AppDb,
  | "listTodos"
  | "listTodoStatuses"
  | "updateTodoStatus"
  | "createTodoStatus"
  | "deleteTodoStatus"
  | "listInitiatives"
>;

type TodosViewProps = {
  db?: TodosDb;
  onToast?: (message: string) => void;
  onOpenNote: (noteId: number) => void;
};

type Completion = "all" | "open" | "done";

const ignoreToast = () => undefined;

const FILTERS: Array<{ value: Completion; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "open", label: "Açık" },
  { value: "done", label: "Tamamlananlar" },
];

const NEEDS_INITIATIVE_ERROR = "İş seçimi gerekli";
const NO_INITIATIVE_TOAST =
  "Bağlı iş yok; durum kaydedildi, işe not yazılmadı";

type PendingPick = {
  todo: TodoListItem;
  statusId: number;
  options: TodoInitiativeOption[];
};

export default function TodosView({
  db = getDb(),
  onToast = ignoreToast,
  onOpenNote,
}: TodosViewProps) {
  const [completion, setCompletion] = useState<Completion>("all");
  const [todos, setTodos] = useState<TodoListItem[]>([]);
  const [statuses, setStatuses] = useState<TodoStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(PERSON_LABEL_COLORS[0]);
  const [newCountsAsComplete, setNewCountsAsComplete] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextTodos, nextStatuses] = await Promise.all([
        db.listTodos({ completion }),
        db.listTodoStatuses(),
      ]);
      setTodos(nextTodos);
      setStatuses(nextStatuses);
    } catch (error) {
      onToast(formatError(error, "Yapılacaklar yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, [completion, db, onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyStatus = async (
    todo: TodoListItem,
    statusId: number,
    initiativeId?: number,
  ) => {
    const newStatus = statuses.find((status) => status.id === statusId);
    try {
      await db.updateTodoStatus(
        todo.id,
        statusId,
        initiativeId === undefined ? undefined : { initiativeId },
      );
    } catch (error) {
      const message = formatError(error, "Durum güncellenemedi");
      if (message === NEEDS_INITIATIVE_ERROR && initiativeId === undefined) {
        const initiatives = await db.listInitiatives().catch(() => []);
        setPendingPick({
          todo,
          statusId,
          options: todo.initiativeIds.map((id) => ({
            id,
            name:
              initiatives.find((initiative) => initiative.id === id)?.name ??
              `İş #${id}`,
          })),
        });
        return;
      }
      onToast(message);
      return;
    }
    if (
      newStatus?.countsAsComplete &&
      !todo.countsAsComplete &&
      todo.initiativeIds.length === 0
    ) {
      onToast(NO_INITIATIVE_TOAST);
    }
    await load();
  };

  const addStatus = async () => {
    try {
      await db.createTodoStatus({
        name: newName,
        color: newColor,
        countsAsComplete: newCountsAsComplete,
      });
      setNewName("");
      setNewCountsAsComplete(false);
      await load();
    } catch (error) {
      onToast(formatError(error, "Durum eklenemedi"));
    }
  };

  const removeStatus = async (status: TodoStatus) => {
    try {
      await db.deleteTodoStatus(status.id);
      await load();
    } catch (error) {
      onToast(formatError(error, "Durum silinemedi"));
    }
  };

  const customStatuses = statuses.filter((status) => !status.isBuiltin);

  return (
    <section className="todos-view">
      <h1>Yapılacaklar</h1>
      <div className="todos-view__filters" role="group" aria-label="Filtre">
        {FILTERS.map((filter) => (
          <button
            aria-pressed={completion === filter.value}
            className={`ayarlar-chip${
              completion === filter.value ? " ayarlar-chip--active" : ""
            }`}
            key={filter.value}
            onClick={() => setCompletion(filter.value)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Yükleniyor…</p>
      ) : todos.length === 0 ? (
        <p>Yapılacak yok.</p>
      ) : (
        <ul aria-label="Yapılacaklar" className="todos-list">
          {todos.map((todo) => (
            <li className="todos-list__item" key={todo.id}>
              <div className="todos-list__main">
                <strong
                  className={
                    todo.countsAsComplete ? "todos-list__title--done" : undefined
                  }
                >
                  {todo.title}
                </strong>
                <time dateTime={todo.updatedAt}>
                  {formatRelativeTr(todo.updatedAt)}
                </time>
              </div>
              <div className="todos-list__actions">
                <select
                  aria-label={`${todo.title} durumu`}
                  className={`todos-list__status person-label--${todo.statusColor}`}
                  onChange={(event) =>
                    void applyStatus(todo, Number(event.target.value))
                  }
                  value={todo.statusId}
                >
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => onOpenNote(todo.noteId)} type="button">
                  Nota git
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Durumlar" className="todos-statuses">
        <h2>Durumlar</h2>
        <form
          className="todos-statuses__form"
          onSubmit={(event) => {
            event.preventDefault();
            void addStatus();
          }}
        >
          <input
            aria-label="Durum adı"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Yeni durum"
            value={newName}
          />
          <div className="todos-statuses__colors">
            {PERSON_LABEL_COLORS.map((color) => (
              <button
                aria-label={`Renk: ${color}`}
                aria-pressed={newColor === color}
                className={`person-label-chip person-label--${color}${
                  newColor === color ? " todos-statuses__color--selected" : ""
                }`}
                key={color}
                onClick={() => setNewColor(color)}
                type="button"
              >
                {color}
              </button>
            ))}
          </div>
          <label>
            <input
              checked={newCountsAsComplete}
              onChange={(event) => setNewCountsAsComplete(event.target.checked)}
              type="checkbox"
            />
            Tamamlandı say
          </label>
          <button type="submit">Durum ekle</button>
        </form>
        {customStatuses.length > 0 ? (
          <ul className="todos-statuses__list">
            {customStatuses.map((status) => (
              <li key={status.id}>
                <span
                  className={`person-label-badge person-label--${status.color}`}
                >
                  {status.name}
                </span>
                {status.countsAsComplete ? <small>tamamlandı sayılır</small> : null}
                <button
                  aria-label={`${status.name} sil`}
                  onClick={() => void removeStatus(status)}
                  type="button"
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {pendingPick ? (
        <TodoInitiativePicker
          onCancel={() => setPendingPick(null)}
          onConfirm={(initiativeId) => {
            const { todo, statusId } = pendingPick;
            setPendingPick(null);
            void applyStatus(todo, statusId, initiativeId);
          }}
          options={pendingPick.options}
        />
      ) : null}
    </section>
  );
}
