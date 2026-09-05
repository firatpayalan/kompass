import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import InitiativeForm from "../components/InitiativeForm";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import { formatRelativeTr } from "../lib/formatRelativeTr";
import type { Initiative, InitiativeStatus } from "../lib/types";

type InitiativesDb = Pick<
  AppDb,
  | "createInitiative"
  | "createNote"
  | "listInitiatives"
  | "reorderInitiatives"
  | "archiveInitiative"
>;

type InitiativesViewProps = {
  db?: InitiativesDb;
  onSelectInitiative?: (initiative: Initiative) => void;
  onToast?: (message: string) => void;
};

const ignore = () => undefined;
const DRAG_THRESHOLD_PX = 6;

const statusLabels: Record<InitiativeStatus, string> = {
  aktif: "Aktif",
  beklemede: "Beklemede",
  bitti: "Bitti",
};

function namesMatch(left: string, right: string): boolean {
  return left.localeCompare(right, "tr", { sensitivity: "base" }) === 0;
}

export function moveInitiative(
  initiatives: Initiative[],
  fromId: number,
  toId: number,
): Initiative[] {
  if (fromId === toId) return initiatives;
  const fromIndex = initiatives.findIndex((item) => item.id === fromId);
  const toIndex = initiatives.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) return initiatives;
  const next = [...initiatives];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function targetInitiativeIdAtPoint(
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

export default function InitiativesView({
  db = getDb(),
  onSelectInitiative = ignore,
  onToast = ignore,
}: InitiativesViewProps) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<number | null>(null);
  const [menu, setMenu] = useState<{
    initiativeId: number;
    x: number;
    y: number;
  } | null>(null);
  const [initiativeToArchive, setInitiativeToArchive] =
    useState<Initiative | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initiativesRef = useRef(initiatives);
  const dragRef = useRef<{
    id: number;
    startY: number;
    active: boolean;
    order: Initiative[];
  } | null>(null);
  const persistOrderRef = useRef<(next: Initiative[]) => Promise<void>>(
    async () => undefined,
  );

  initiativesRef.current = initiatives;

  const loadInitiatives = useCallback(async () => {
    try {
      const loaded = await db.listInitiatives();
      setInitiatives(loaded);
      return loaded;
    } catch {
      onToast("İşler yüklenemedi");
      return [];
    } finally {
      setLoading(false);
    }
  }, [db, onToast]);

  useEffect(() => {
    void loadInitiatives();
  }, [loadInitiatives]);

  persistOrderRef.current = async (next: Initiative[]) => {
    try {
      await db.reorderInitiatives(next.map((item) => item.id));
    } catch {
      onToast("Sıra kaydedilemedi");
      await loadInitiatives();
    }
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
        ? [
            ...listRef.current.querySelectorAll<HTMLElement>(
              "[data-initiative-id]",
            ),
          ]
        : [];
      const rows = rowEls.map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          id: Number(row.dataset.initiativeId),
          top: rect.top,
          height: rect.height,
        };
      });
      const overId = targetInitiativeIdAtPoint(event.clientY, rows);
      if (overId == null) return;

      const next = moveInitiative(session.order, session.id, overId);
      if (
        next.every((item, index) => item.id === session.order[index]?.id)
      ) {
        return;
      }
      session.order = next;
      setInitiatives(next);
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

  const startPointerDrag = (initiativeId: number, clientY: number) => {
    dragRef.current = {
      id: initiativeId,
      startY: clientY,
      active: false,
      order: initiativesRef.current,
    };
  };

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  const openInitiativeMenu = (event: MouseEvent, initiativeId: number) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ initiativeId, x: event.clientX, y: event.clientY });
  };

  const confirmArchiveInitiative = async () => {
    if (!initiativeToArchive) return;
    try {
      await db.archiveInitiative(
        initiativeToArchive.id,
        new Date().toISOString(),
      );
      setInitiativeToArchive(null);
      onToast("İş arşivlendi");
      await loadInitiatives();
    } catch {
      onToast("İş arşivlenemedi");
    }
  };

  const useExisting = async (name: string) => {
    const loaded = await loadInitiatives();
    return loaded.find((item) => namesMatch(item.name, name)) ?? null;
  };

  return (
    <section className="entity-view">
      <header>
        <div>
          <h1>İşler</h1>
          <p>İşlerin durumunu ve engellerini tek yerde izleyin.</p>
        </div>
        <InitiativeForm
          createInitiative={db.createInitiative}
          createNote={db.createNote}
          onCreated={onSelectInitiative}
          onDuplicate={useExisting}
          onToast={onToast}
        />
      </header>
      <h2>İş listesi</h2>
      {loading ? (
        <p>İşler yükleniyor…</p>
      ) : initiatives.length === 0 ? (
        <p>Henüz iş yok.</p>
      ) : (
        <ul className="entity-list" ref={listRef}>
          {initiatives.map((initiative) => (
            <li
              className={
                dragId === initiative.id
                  ? "entity-list__row entity-list__row--dragging"
                  : "entity-list__row"
              }
              data-initiative-id={initiative.id}
              key={initiative.id}
              onContextMenu={(event) =>
                openInitiativeMenu(event, initiative.id)
              }
            >
              <button
                aria-label={`${initiative.name} sırasını değiştir`}
                className="entity-list__handle"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  startPointerDrag(initiative.id, event.clientY);
                }}
                type="button"
              >
                ⠿
              </button>
              <button
                aria-label={initiative.name}
                className="entity-list__open"
                onClick={() => onSelectInitiative(initiative)}
                onContextMenu={(event) =>
                  openInitiativeMenu(event, initiative.id)
                }
                type="button"
              >
                <span className="entity-list__heading entity-list__heading--activity">
                  <strong>{initiative.name}</strong>
                  <span className="entity-list__activity">
                    <time
                      dateTime={initiative.lastActivityAt}
                      title={new Date(
                        initiative.lastActivityAt,
                      ).toLocaleString("tr-TR")}
                    >
                      {formatRelativeTr(initiative.lastActivityAt)}
                    </time>
                  </span>
                  <span className={`status status--${initiative.status}`}>
                    {statusLabels[initiative.status]}
                  </span>
                </span>
                {initiative.status === "beklemede" &&
                initiative.blockerSummary ? (
                  <span>Engel: {initiative.blockerSummary}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {menu ? (
        <div
          className="person-label-menu"
          ref={menuRef}
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            className="person-label-menu__danger"
            onClick={() => {
              const target =
                initiatives.find((item) => item.id === menu.initiativeId) ??
                null;
              setMenu(null);
              setInitiativeToArchive(target);
            }}
            type="button"
          >
            İşi arşivle
          </button>
        </div>
      ) : null}
      {initiativeToArchive ? (
        <ConfirmDialog
          confirmLabel="Arşivle"
          message={`“${initiativeToArchive.name}” arşivlenecek. Bağlı notlar da arşive gider. Emin misiniz?`}
          onCancel={() => setInitiativeToArchive(null)}
          onConfirm={() => void confirmArchiveInitiative()}
          title="İşi arşivle"
        />
      ) : null}
    </section>
  );
}
