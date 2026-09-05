import { useEffect, useState } from "react";
import LinkedNotes from "../components/LinkedNotes";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type {
  Initiative,
  InitiativeStatus,
  Note,
} from "../lib/types";

type InitiativeDetailViewProps = {
  db?: Pick<AppDb, "listNotesForInitiative">;
  initiative: Initiative;
  onBack: () => void;
  onToast?: (message: string) => void;
};

const ignore = () => undefined;

const statusLabels: Record<InitiativeStatus, string> = {
  aktif: "Aktif",
  beklemede: "Beklemede",
  bitti: "Bitti",
};

export default function InitiativeDetailView({
  db = getDb(),
  initiative,
  onBack,
  onToast = ignore,
}: InitiativeDetailViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.listNotesForInitiative(initiative.id)
      .then((loaded) => {
        if (active) {
          setNotes(loaded);
        }
      })
      .catch(() => {
        if (active) {
          onToast("Bağlı notlar yüklenemedi");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [db, initiative.id, onToast]);

  return (
    <section className="detail-view">
      <button className="back-button" onClick={onBack} type="button">
        ← İşlere dön
      </button>
      <div className="detail-view__heading">
        <h1>{initiative.name}</h1>
        <span className={`status status--${initiative.status}`}>
          {statusLabels[initiative.status]}
        </span>
      </div>
      <dl>
        <div>
          <dt>Engel özeti</dt>
          <dd>{initiative.blockerSummary || "Engel belirtilmedi."}</dd>
        </div>
      </dl>
      <h2>Bağlı notlar</h2>
      <LinkedNotes loading={loading} notes={notes} />
    </section>
  );
}
