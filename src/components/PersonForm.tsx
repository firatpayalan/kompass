import { useEffect, useState, type FormEvent } from "react";
import type { AppDb } from "../db/appDb";
import { formatError, isDuplicateNameError } from "../lib/formatError";
import type { Person, PersonLabel } from "../lib/types";
import type { PersonLabelColor } from "../lib/personLabels";
import PersonLabelPicker from "./PersonLabelPicker";

type PersonFormProps = {
  createPerson: AppDb["createPerson"];
  listPersonLabels: AppDb["listPersonLabels"];
  createPersonLabel: AppDb["createPersonLabel"];
  updatePersonLabel: AppDb["updatePersonLabel"];
  deletePersonLabel: AppDb["deletePersonLabel"];
  onCreated: (person: Person) => void;
  onDuplicate: (name: string) => Promise<Person | null>;
  onToast: (message: string) => void;
};

export default function PersonForm({
  createPerson,
  listPersonLabels,
  createPersonLabel,
  updatePersonLabel,
  deletePersonLabel,
  onCreated,
  onDuplicate,
  onToast,
}: PersonFormProps) {
  const [name, setName] = useState("");
  const [roleOrNotes, setRoleOrNotes] = useState("");
  const [labelId, setLabelId] = useState<number | null>(null);
  const [labels, setLabels] = useState<PersonLabel[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reloadLabels = async () => {
    try {
      setLabels(await listPersonLabels());
    } catch (error) {
      const message = formatError(error, "Etiketler yüklenemedi");
      setFormError(message);
      onToast(message);
    }
  };

  useEffect(() => {
    void reloadLabels();
  }, [listPersonLabels]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    setFormError(null);
    if (!trimmedName) {
      const message = "Ad boş olamaz";
      setFormError(message);
      onToast(message);
      return;
    }

    setSaving(true);
    try {
      const person = await createPerson({
        name: trimmedName,
        roleOrNotes: roleOrNotes.trim() || null,
        labelId,
        nowIso: new Date().toISOString(),
      });
      setName("");
      setRoleOrNotes("");
      setLabelId(null);
      setFormError(null);
      onCreated(person);
    } catch (error) {
      if (isDuplicateNameError(error)) {
        const message = "Bu isimde kayıt var";
        setFormError(message);
        onToast(message);
        const existing = await onDuplicate(trimmedName);
        if (existing) {
          onCreated(existing);
        }
      } else {
        const message = formatError(error, "Kişi eklenemedi");
        setFormError(message);
        onToast(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="entity-form" onSubmit={submit}>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <label>
        Ad
        <input
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>
      <label>
        Rol / not
        <textarea
          onChange={(event) => setRoleOrNotes(event.target.value)}
          rows={3}
          value={roleOrNotes}
        />
      </label>
      <PersonLabelPicker
        labels={labels}
        onChange={setLabelId}
        onCreate={async (labelName: string, color: PersonLabelColor) => {
          const label = await createPersonLabel({ name: labelName, color });
          await reloadLabels();
          return label;
        }}
        onUpdate={async (id, patch) => {
          const label = await updatePersonLabel(id, patch);
          await reloadLabels();
          return label;
        }}
        onDelete={async (id) => {
          await deletePersonLabel(id);
          await reloadLabels();
          if (labelId === id) {
            setLabelId(null);
          }
        }}
        onToast={onToast}
        value={labelId}
      />
      <button disabled={saving} type="submit">
        {saving ? "Ekleniyor…" : "Kişi ekle"}
      </button>
    </form>
  );
}
