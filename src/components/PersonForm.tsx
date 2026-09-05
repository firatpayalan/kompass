import { useState, type FormEvent } from "react";
import type { AppDb } from "../db/appDb";
import type { Person } from "../lib/types";

type PersonFormProps = {
  createPerson: AppDb["createPerson"];
  onCreated: (person: Person) => void;
  onDuplicate: (name: string) => Promise<Person | null>;
  onToast: (message: string) => void;
};

export default function PersonForm({
  createPerson,
  onCreated,
  onDuplicate,
  onToast,
}: PersonFormProps) {
  const [name, setName] = useState("");
  const [roleOrNotes, setRoleOrNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
        nowIso: new Date().toISOString(),
      });
      setName("");
      setRoleOrNotes("");
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
      <button disabled={saving} type="submit">
        {saving ? "Ekleniyor…" : "Kişi ekle"}
      </button>
    </form>
  );
}
