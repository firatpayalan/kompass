import { useState } from "react";
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
    <div className="person-label-picker">
      <label>
        İlişki
        <select
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? null : Number(next));
          }}
          value={value ?? ""}
        >
          <option value="">Etiket yok</option>
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      </label>

      {creating ? (
        <div className="person-label-picker__create">
          <label>
            Yeni etiket
            <input
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
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
      ) : (
        <button
          className="person-label-picker__toggle"
          onClick={() => setCreating(true)}
          type="button"
        >
          Yeni etiket
        </button>
      )}
    </div>
  );
}
