import { useState } from "react";

export type TodoInitiativeOption = { id: number; name: string };

type TodoInitiativePickerProps = {
  options: TodoInitiativeOption[];
  onCancel: () => void;
  onConfirm: (initiativeId: number) => void;
};

export default function TodoInitiativePicker({
  options,
  onCancel,
  onConfirm,
}: TodoInitiativePickerProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    options[0]?.id ?? null,
  );

  return (
    <div
      aria-labelledby="todo-initiative-picker-title"
      aria-modal="true"
      className="modal-backdrop"
      role="dialog"
    >
      <section className="quick-note-modal">
        <h2 id="todo-initiative-picker-title">İş seçimi</h2>
        <p>Tamamlama notu hangi işe yazılsın?</p>
        <div className="todo-picker__options" role="radiogroup">
          {options.map((option) => (
            <label className="todo-picker__option" key={option.id}>
              <input
                checked={selectedId === option.id}
                name="todo-initiative"
                onChange={() => setSelectedId(option.id)}
                type="radio"
              />
              {option.name}
            </label>
          ))}
        </div>
        <footer>
          <button onClick={onCancel} type="button">
            Vazgeç
          </button>
          <button
            disabled={selectedId === null}
            onClick={() => {
              if (selectedId !== null) {
                onConfirm(selectedId);
              }
            }}
            type="button"
          >
            Onayla
          </button>
        </footer>
      </section>
    </div>
  );
}
