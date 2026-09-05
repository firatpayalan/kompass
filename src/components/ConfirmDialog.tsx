type ConfirmDialogProps = {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  message,
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
        <h2 id="confirm-dialog-title">Kalıcı silme onayı</h2>
        <p>{message}</p>
        <footer>
          <button onClick={onCancel} type="button">
            Vazgeç
          </button>
          <button onClick={onConfirm} type="button">
            Kalıcı olarak sil
          </button>
        </footer>
      </section>
    </div>
  );
}
