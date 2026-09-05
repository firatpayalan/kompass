import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import ConfirmDialog from "./ConfirmDialog";

type MenuState = { noteId: number; body: string; x: number; y: number };

type NoteArchiveShellProps = {
  enabled: boolean;
  onArchive: (noteId: number) => Promise<void>;
  children: (helpers: {
    openArchiveMenu: (event: MouseEvent, note: { id: number; body: string }) => void;
  }) => ReactNode;
};

export default function NoteArchiveShell({
  enabled,
  onArchive,
  children,
}: NoteArchiveShellProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pending, setPending] = useState<{ id: number; body: string } | null>(
    null,
  );

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

  if (!enabled) {
    return <>{children({ openArchiveMenu: () => undefined })}</>;
  }

  const openArchiveMenu = (
    event: MouseEvent,
    note: { id: number; body: string },
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      noteId: note.id,
      body: note.body,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const confirmArchive = async () => {
    if (!pending) return;
    const id = pending.id;
    setPending(null);
    await onArchive(id);
  };

  return (
    <>
      {children({ openArchiveMenu })}
      {menu ? (
        <div
          className="person-label-menu"
          ref={menuRef}
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            className="person-label-menu__danger"
            onClick={() => {
              setPending({ id: menu.noteId, body: menu.body });
              setMenu(null);
            }}
            type="button"
          >
            Arşivle
          </button>
        </div>
      ) : null}
      {pending ? (
        <ConfirmDialog
          confirmLabel="Arşivle"
          message="Bu not arşivlenecek ve Arşiv’de görünecek. Emin misiniz?"
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmArchive()}
          title="Notu arşivle"
        />
      ) : null}
    </>
  );
}
