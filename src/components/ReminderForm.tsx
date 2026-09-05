import type { ReminderPeriod } from "../lib/types";

export type ReminderDraft = {
  dueAt: string;
  period: ReminderPeriod;
};

type ReminderFormProps = {
  enabled: boolean;
  dueAt: string;
  period: ReminderPeriod;
  onEnabledChange: (enabled: boolean) => void;
  onDueAtChange: (dueAt: string) => void;
  onPeriodChange: (period: ReminderPeriod) => void;
};

export default function ReminderForm({
  enabled,
  dueAt,
  period,
  onEnabledChange,
  onDueAtChange,
  onPeriodChange,
}: ReminderFormProps) {
  return (
    <fieldset className="reminder-form">
      <label>
        <input
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          type="checkbox"
        />
        Hatırlatma ekle
      </label>
      {enabled ? (
        <div className="reminder-form__fields">
          <label>
            Hatırlatma zamanı
            <input
              onChange={(event) => onDueAtChange(event.target.value)}
              required
              type="datetime-local"
              value={dueAt}
            />
          </label>
          <label>
            Tekrar
            <select
              onChange={(event) =>
                onPeriodChange(event.target.value as ReminderPeriod)
              }
              value={period}
            >
              <option value="once">Bir kez</option>
              <option value="daily">Her gün</option>
              <option value="weekly">Her hafta</option>
              <option value="monthly">Her ay</option>
            </select>
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}
