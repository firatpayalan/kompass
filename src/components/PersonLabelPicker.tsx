import { useId, useState } from "react";
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
  onToast: (message: string) => void;
};

export default function PersonLabelPicker({
  labels,
  value,
  onChange,
  onCreate,
  onToast,
}: PersonLabelPickerProps) {
  const headingId = useId();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<PersonLabelColor>("slate");
  const [saving, setSaving] = useState(false);

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

      <div className="person-label-picker__chips" role="listbox" aria-label="İlişki etiketleri">
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
    </div>
  );
}
