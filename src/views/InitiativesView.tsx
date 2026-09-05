import { useCallback, useEffect, useState } from "react";
import InitiativeForm from "../components/InitiativeForm";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Initiative, InitiativeStatus } from "../lib/types";

type InitiativesDb = Pick<AppDb, "createInitiative" | "listInitiatives">;

type InitiativesViewProps = {
  db?: InitiativesDb;
  onSelectInitiative?: (initiative: Initiative) => void;
  onToast?: (message: string) => void;
};

const ignore = () => undefined;

const statusLabels: Record<InitiativeStatus, string> = {
  aktif: "Aktif",
  beklemede: "Beklemede",
  bitti: "Bitti",
};

function namesMatch(left: string, right: string): boolean {
  return left.localeCompare(right, "tr", { sensitivity: "base" }) === 0;
}

export default function InitiativesView({
  db = getDb(),
  onSelectInitiative = ignore,
  onToast = ignore,
}: InitiativesViewProps) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);

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
        <ul className="entity-list">
          {initiatives.map((initiative) => (
            <li key={initiative.id}>
              <button
                onClick={() => onSelectInitiative(initiative)}
                type="button"
              >
                <span className="entity-list__heading">
                  <strong>{initiative.name}</strong>
                  <span className={`status status--${initiative.status}`}>
                    {statusLabels[initiative.status]}
                  </span>
                </span>
                {initiative.blockerSummary ? (
                  <span>Engel: {initiative.blockerSummary}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
