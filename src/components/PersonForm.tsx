import { useEffect, useState, type FormEvent } from "react";
import type { AppDb } from "../db/appDb";
import type { Person, PersonLabel } from "../lib/types";
import type { PersonLabelColor } from "../lib/personLabels";
import PersonLabelPicker from "./PersonLabelPicker";

type PersonFormProps = {
  createPerson: AppDb["createPerson"];
  listPersonLabels: AppDb["listPersonLabels"];
  createPersonLabel: AppDb["createPersonLabel"];
  updatePersonLabel: AppDb["updatePersonLabel"];
  onCreated: (person: Person) => void;
  onDuplicate: (name: string) => Promise<Person | null>;
  onToast: (message: string) => void;
};

export default function PersonForm({
  createPerson,
  listPersonLabels,
  createPersonLabel,
  updatePersonLabel,
  onCreated,
  onDuplicate,
  onToast,
}: PersonFormProps) {
  const [name, setName] = useState("");
  const [roleOrNotes, setRoleOrNotes] = useState("");
  const [labelId, setLabelId] = useState<number | null>(null);
  const [labels, setLabels] = useState<PersonLabel[]>([]);
  const [saving, setSaving] = useState(false);

  const reloadLabels = async () => {
    try {
      setLabels(await listPersonLabels());
    } catch {
      onToast("Etiketler yüklenemedi");
    }
  };

  useEffect(() => {
    void reloadLabels();
  }, [listPersonLabels]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      onToast("Ad boş olamaz");
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
      onCreated(person);
    } catch (error) {
      if (error instanceof Error && error.message === "Bu isimde kayıt var") {
        onToast(error.message);
        const existing = await onDuplicate(trimmedName);
        if (existing) {
          onCreated(existing);
        }
      } else {
        onToast("Kişi eklenemedi");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="entity-form" onSubmit={submit}>
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
        onToast={onToast}
        value={labelId}
      />
      <button disabled={saving} type="submit">
        {saving ? "Ekleniyor…" : "Kişi ekle"}
      </button>
    </form>
  );
}
