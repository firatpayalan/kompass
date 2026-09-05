import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import type { PersonLabel } from "../lib/types";
import {
  PERSON_LABEL_COLORS,
  type PersonLabelColor,
} from "../lib/personLabels";

type PersonLabelPickerProps = {
  labels: PersonLabel[];
  value: number | null;
  onChange: (labelId: number | null) => void;
  onCreate: (name: string, color: PersonLabelColor) => Promise<PersonLabel>;
  onUpdate: (
    id: number,
    patch: { name?: string; color?: PersonLabelColor },
  ) => Promise<PersonLabel>;
  onDelete: (id: number) => Promise<void>;
  onToast: (message: string) => void;
};

type MenuState =
  | { kind: "main"; labelId: number; x: number; y: number }
  | { kind: "color"; labelId: number; x: number; y: number }
  | { kind: "confirm-delete"; labelId: number; x: number; y: number };

export default function PersonLabelPicker({
  labels,
  value,
  onChange,
  onCreate,
  onUpdate,
  onDelete,
  onToast,
}: PersonLabelPickerProps) {
  const headingId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<PersonLabelColor>("slate");
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

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

  const submitNew = async () => {
    if (!name.trim()) {
      onToast("Etiket adı boş olamaz");
      return;
    }
    setSaving(true);
    try {
      const label = await onCreate(name.trim(), color);
      setName("");
      setColor("slate");
      setCreating(false);
      onChange(label.id);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Etiket eklenemedi",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveRename = async () => {
    if (renamingId === null) return;
    const trimmed = renameDraft.trim();
    const current = labels.find((label) => label.id === renamingId);
    if (!current) {
      setRenamingId(null);
      return;
    }
    if (!trimmed) {
      onToast("Etiket adı boş olamaz");
      return;
    }
    if (
      trimmed.localeCompare(current.name, "tr", { sensitivity: "base" }) === 0
    ) {
      setRenamingId(null);
      return;
    }
    try {
      await onUpdate(renamingId, { name: trimmed });
      setRenamingId(null);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Etiket güncellenemedi",
      );
    }
  };

  const saveColor = async (labelId: number, nextColor: PersonLabelColor) => {
    try {
      await onUpdate(labelId, { color: nextColor });
      setMenu(null);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Etiket güncellenemedi",
      );
    }
  };

  const removeLabel = async (labelId: number) => {
    try {
      await onDelete(labelId);
      if (value === labelId) {
        onChange(null);
      }
      setMenu(null);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Etiket silinemedi");
    }
  };

  const openMenu = (event: MouseEvent, labelId: number) => {
    event.preventDefault();
    event.stopPropagation();
    setRenamingId(null);
    setMenu({ kind: "main", labelId, x: event.clientX, y: event.clientY });
  };

  return (
    <div aria-labelledby={headingId} className="person-label-picker" role="group">
      <div className="person-label-picker__header">
        <span className="person-label-picker__title" id={headingId}>
          İlişki
        </span>
        {!creating ? (
          <button
            className="person-label-picker__toggle"
            onClick={() => setCreating(true)}
            type="button"
          >
            Yeni etiket
          </button>
        ) : null}
      </div>

      <div
        aria-label="İlişki etiketleri"
        className="person-label-picker__chips"
        role="listbox"
      >
        <button
          aria-selected={value === null}
          className={
            value === null
              ? "person-label-chip person-label-chip--none person-label-chip--selected"
              : "person-label-chip person-label-chip--none"
          }
          onClick={() => onChange(null)}
          role="option"
          type="button"
        >
          Yok
        </button>
        {labels.map((label) => {
          const selected = value === label.id;
          if (renamingId === label.id) {
            return (
              <input
                aria-label="Etiket adını düzenle"
                autoFocus
                className={`person-label-chip-input person-label--${label.color}`}
                key={label.id}
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
                    setRenamingId(null);
                  }
                }}
                value={renameDraft}
              />
            );
          }
          return (
            <button
              aria-selected={selected}
              className={
                selected
                  ? `person-label-chip person-label--${label.color} person-label-chip--selected`
                  : `person-label-chip person-label--${label.color}`
              }
              key={label.id}
              onClick={() => onChange(label.id)}
              onContextMenu={(event) => openMenu(event, label.id)}
              role="option"
              type="button"
            >
              {label.name}
            </button>
          );
        })}
      </div>

      {creating ? (
        <div className="person-label-picker__create">
          <label>
            Yeni etiket adı
            <input
              autoComplete="off"
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn. Mentor"
              value={name}
            />
          </label>
          <fieldset className="person-label-picker__swatches">
            <legend>Renk</legend>
            {PERSON_LABEL_COLORS.map((token) => (
              <label
                key={token}
                className={`person-label-swatch person-label--${token}`}
              >
                <input
                  checked={color === token}
                  name="person-label-color"
                  onChange={() => setColor(token)}
                  type="radio"
                  value={token}
                />
                <span className="visually-hidden">{token}</span>
              </label>
            ))}
          </fieldset>
          <div className="person-label-picker__actions">
            <button onClick={() => setCreating(false)} type="button">
              Vazgeç
            </button>
            <button disabled={saving} onClick={submitNew} type="button">
              {saving ? "Ekleniyor…" : "Etiket ekle"}
            </button>
          </div>
        </div>
      ) : null}

      {menu ? (
        <div
          className="person-label-menu"
          ref={menuRef}
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.kind === "main" ? (
            <>
              <button
                onClick={() => {
                  const label = labels.find((item) => item.id === menu.labelId);
                  setRenameDraft(label?.name ?? "");
                  setRenamingId(menu.labelId);
                  setMenu(null);
                }}
                type="button"
              >
                İsim değiştir
              </button>
              <button
                onClick={() =>
                  setMenu({
                    kind: "color",
                    labelId: menu.labelId,
                    x: menu.x,
                    y: menu.y,
                  })
                }
                type="button"
              >
                Renk değiştir
              </button>
              <button
                className="person-label-menu__danger"
                onClick={() =>
                  setMenu({
                    kind: "confirm-delete",
                    labelId: menu.labelId,
                    x: menu.x,
                    y: menu.y,
                  })
                }
                type="button"
              >
                Etiket sil
              </button>
            </>
          ) : menu.kind === "color" ? (
            <div className="person-label-menu__swatches">
              {PERSON_LABEL_COLORS.map((token) => (
                <button
                  aria-label={token}
                  className={`person-label-swatch person-label--${token}`}
                  key={token}
                  onClick={() => {
                    void saveColor(menu.labelId, token);
                  }}
                  type="button"
                />
              ))}
            </div>
          ) : (
            <div className="person-label-menu__confirm">
              <p>
                “
                {labels.find((item) => item.id === menu.labelId)?.name ??
                  "Etiket"}
                ” silinsin mi?
              </p>
              <div className="person-label-menu__confirm-actions">
                <button onClick={() => setMenu(null)} type="button">
                  Vazgeç
                </button>
                <button
                  className="person-label-menu__danger"
                  onClick={() => {
                    void removeLabel(menu.labelId);
                  }}
                  type="button"
                >
                  Sil
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
