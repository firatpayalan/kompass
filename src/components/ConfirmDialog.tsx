type ConfirmDialogProps = {
  title?: string;
  message: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  title = "Kalıcı silme onayı",
  message,
  confirmLabel = "Kalıcı olarak sil",
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div
      aria-labelledby="confirm-dialog-title"
      aria-modal="true"
      className="modal-backdrop"
      role="dialog"
    >
      <section className="quick-note-modal">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        <footer>
          <button onClick={onCancel} type="button">
            Vazgeç
          </button>
          <button
            disabled={confirmDisabled}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
