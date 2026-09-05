import { useState, type FormEvent } from "react";
import type { AppDb } from "../db/appDb";
import type { Initiative, InitiativeStatus } from "../lib/types";

type InitiativeFormProps = {
  createInitiative: AppDb["createInitiative"];
  onCreated: (initiative: Initiative) => void;
  onDuplicate: (name: string) => Promise<Initiative | null>;
  onToast: (message: string) => void;
};

export default function InitiativeForm({
  createInitiative,
  onCreated,
  onDuplicate,
  onToast,
}: InitiativeFormProps) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<InitiativeStatus>("aktif");
  const [blockerSummary, setBlockerSummary] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      onToast("İş adı boş olamaz");
      return;
    }

    setSaving(true);
    try {
      const initiative = await createInitiative({
        name: trimmedName,
        status,
        blockerSummary: blockerSummary.trim() || null,
        nowIso: new Date().toISOString(),
      });
      setName("");
      setStatus("aktif");
      setBlockerSummary("");
      onCreated(initiative);
    } catch (error) {
      if (error instanceof Error && error.message === "Bu isimde kayıt var") {
        onToast(error.message);
        const existing = await onDuplicate(trimmedName);
        if (existing) {
          onCreated(existing);
        }
      } else {
        onToast("İş eklenemedi");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="entity-form" onSubmit={submit}>
      <label>
        İş adı
        <input
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>
      <label>
        Durum
        <select
          onChange={(event) =>
            setStatus(event.target.value as InitiativeStatus)
          }
          value={status}
        >
          <option value="aktif">Aktif</option>
          <option value="beklemede">Beklemede</option>
          <option value="bitti">Bitti</option>
        </select>
      </label>
      <label>
        Engel özeti
        <textarea
          onChange={(event) => setBlockerSummary(event.target.value)}
          rows={3}
          value={blockerSummary}
        />
      </label>
      <button disabled={saving} type="submit">
        {saving ? "Ekleniyor…" : "İş ekle"}
      </button>
    </form>
  );
}
