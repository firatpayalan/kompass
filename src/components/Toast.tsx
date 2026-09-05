type ToastProps = {
  message: string | null;
  onDismiss: () => void;
};

export default function Toast({ message, onDismiss }: ToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <button aria-label="Bildirimi kapat" onClick={onDismiss} type="button">
        Kapat
      </button>
    </div>
  );
}
