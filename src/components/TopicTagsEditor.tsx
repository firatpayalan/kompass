import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { TopicTag } from "../lib/types";
import {
  PERSON_LABEL_COLORS,
  type PersonLabelColor,
} from "../lib/personLabels";

type TopicTagsEditorProps = {
  tags: TopicTag[];
  catalog?: TopicTag[];
  colorInputName?: string;
  onAdd: (name: string, color: PersonLabelColor) => Promise<void>;
  onLinkExisting?: (tagId: number) => Promise<void>;
  onUpdate: (
    id: number,
    patch: { name?: string; color?: PersonLabelColor },
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onToast: (message: string) => void;
};

type MenuState =
  | { kind: "main"; tagId: number; x: number; y: number }
  | { kind: "color"; tagId: number; x: number; y: number }
  | { kind: "confirm-delete"; tagId: number; x: number; y: number };

export default function TopicTagsEditor({
  tags = [],
  catalog = [],
  colorInputName = "topic-tag-color",
  onAdd,
  onLinkExisting,
  onUpdate,
  onDelete,
  onToast,
}: TopicTagsEditorProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<PersonLabelColor>("slate");
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const assignedIds = new Set(tags.map((tag) => tag.id));
  const query = name.trim().toLocaleLowerCase("tr");
  const suggestions = catalog.filter((tag) => {
    if (assignedIds.has(tag.id)) return false;
    if (!query) return true;
    return tag.name.toLocaleLowerCase("tr").includes(query);
  });

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

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      onToast("Etiket adı boş olamaz");
      return;
    }
    setSaving(true);
    try {
      const existing = catalog.find(
        (tag) =>
          tag.name.localeCompare(name.trim(), "tr", {
            sensitivity: "base",
          }) === 0,
      );
      if (existing && onLinkExisting && !assignedIds.has(existing.id)) {
        await onLinkExisting(existing.id);
      } else {
        await onAdd(name.trim(), color);
      }
      setName("");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Etiket eklenemedi");
    } finally {
      setSaving(false);
    }
  };

  const linkSuggestion = async (tagId: number) => {
    if (!onLinkExisting) return;
    setSaving(true);
    try {
      await onLinkExisting(tagId);
      setName("");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Etiket eklenemedi");
    } finally {
      setSaving(false);
    }
  };

  const saveRename = async () => {
    if (renamingId === null) return;
    const current = tags.find((tag) => tag.id === renamingId);
    const trimmed = renameDraft.trim();
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

  const openMenu = (event: MouseEvent, tagId: number) => {
    event.preventDefault();
    event.stopPropagation();
    setRenamingId(null);
    setMenu({ kind: "main", tagId, x: event.clientX, y: event.clientY });
  };

  return (
    <div className="topic-tags-editor">
      <div className="topic-tags-editor__chips">
        {tags.map((tag) =>
          renamingId === tag.id ? (
            <input
              aria-label="Konu etiketini düzenle"
              autoFocus
              className={`person-label-chip-input person-label--${tag.color}`}
              key={tag.id}
              onBlur={() => {
                void saveRename();
              }}
              onChange={(event) => setRenameDraft(event.target.value)}
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
          ) : (
            <button
              className={`person-label-chip person-label-chip--selected person-label--${tag.color}`}
              key={tag.id}
              onContextMenu={(event) => openMenu(event, tag.id)}
              type="button"
            >
              {tag.name}
            </button>
          ),
        )}
      </div>

      <form className="topic-tags-editor__add" onSubmit={submitAdd}>
        <input
          aria-label="Yeni konu etiketi"
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          placeholder="Etiket ekle…"
          value={name}
        />
        <div className="topic-tags-editor__swatches" role="group" aria-label="Etiket rengi">
          {PERSON_LABEL_COLORS.map((token) => (
            <label
              key={token}
              className={`person-label-swatch person-label--${token}${
                color === token ? " person-label-swatch--active" : ""
              }`}
            >
              <input
                checked={color === token}
                name={colorInputName}
                onChange={() => setColor(token)}
                type="radio"
                value={token}
              />
              <span className="visually-hidden">{token}</span>
            </label>
          ))}
        </div>
        <button disabled={saving} type="submit">
          {saving ? "…" : "Ekle"}
        </button>
      </form>

      {suggestions.length > 0 ? (
        <div className="topic-tags-editor__suggestions">
          <span className="topic-tags-editor__suggestions-label">
            Mevcut etiketler
          </span>
          <div className="topic-tags-editor__chips">
            {suggestions.map((tag) => (
              <button
                className={`person-label-chip person-label--${tag.color}`}
                disabled={saving || !onLinkExisting}
                key={tag.id}
                onClick={() => {
                  void linkSuggestion(tag.id);
                }}
                type="button"
              >
                {tag.name}
              </button>
            ))}
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
                  const tag = tags.find((item) => item.id === menu.tagId);
                  setRenameDraft(tag?.name ?? "");
                  setRenamingId(menu.tagId);
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
                    tagId: menu.tagId,
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
                    tagId: menu.tagId,
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
                    void onUpdate(menu.tagId, { color: token }).then(
                      () => setMenu(null),
                      (error: unknown) =>
                        onToast(
                          error instanceof Error
                            ? error.message
                            : "Etiket güncellenemedi",
                        ),
                    );
                  }}
                  type="button"
                />
              ))}
            </div>
          ) : (
            <div className="person-label-menu__confirm">
              <p>
                “
                {tags.find((item) => item.id === menu.tagId)?.name ?? "Etiket"}
                ” silinsin mi?
              </p>
              <div className="person-label-menu__confirm-actions">
                <button onClick={() => setMenu(null)} type="button">
                  Vazgeç
                </button>
                <button
                  className="person-label-menu__danger"
                  onClick={() => {
                    void onDelete(menu.tagId).then(
                      () => setMenu(null),
                      (error: unknown) =>
                        onToast(
                          error instanceof Error
                            ? error.message
                            : "Etiket silinemedi",
                        ),
                    );
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
