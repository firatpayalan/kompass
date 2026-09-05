import { useRef, type ClipboardEvent, type TextareaHTMLAttributes } from "react";
import {
  extractNoteImageIds,
  formatNoteImageMarker,
  insertAtCursor,
  isAllowedNoteImageMime,
  MAX_NOTE_IMAGE_BYTES,
} from "../lib/noteImages";

type SaveNoteImage = (input: {
  id: string;
  mime: string;
  bytesBase64: string;
  nowIso: string;
}) => Promise<void>;

type NoteBodyFieldProps = {
  value: string;
  onChange: (value: string) => void;
  saveNoteImage: SaveNoteImage;
  onToast?: (message: string) => void;
  label?: string;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onPaste"
>;

const ignoreToast = () => undefined;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export default function NoteBodyField({
  value,
  onChange,
  saveNoteImage,
  onToast = ignoreToast,
  label,
  rows = 5,
  placeholder,
  autoFocus,
  disabled,
  className,
  id,
  ...rest
}: NoteBodyFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageIds = extractNoteImageIds(value);

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find(
      (item) => item.kind === "file" && isAllowedNoteImageMime(item.type),
    );
    if (!imageItem) return;

    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    if (file.size > MAX_NOTE_IMAGE_BYTES) {
      onToast("Görsel çok büyük");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const comma = dataUrl.indexOf(",");
      const bytesBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
      const id = crypto.randomUUID();
      await saveNoteImage({
        id,
        mime: file.type,
        bytesBase64,
        nowIso: new Date().toISOString(),
      });
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const marker = formatNoteImageMarker(id);
      const insertion =
        start > 0 && value[start - 1] !== "\n" ? `\n${marker}\n` : `${marker}\n`;
      const { next, caret } = insertAtCursor(value, start, end, insertion);
      onChange(next);
      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(caret, caret);
      });
    } catch {
      onToast("Görsel kaydedilemedi");
    }
  };

  const field = (
    <textarea
      {...rest}
      autoFocus={autoFocus}
      className={className}
      disabled={disabled}
      id={id}
      onChange={(event) => onChange(event.target.value)}
      onPaste={(event) => {
        void handlePaste(event);
      }}
      placeholder={placeholder}
      ref={textareaRef}
      rows={rows}
      value={value}
    />
  );

  return (
    <div className="note-body-field">
      {label ? <label className="note-body-field__label">{label}{field}</label> : field}
      {imageIds.length > 0 ? (
        <p className="note-body-field__hint">
          {imageIds.length === 1
            ? "1 görsel eklendi (yapıştırıldı)"
            : `${imageIds.length} görsel eklendi (yapıştırıldı)`}
        </p>
      ) : null}
    </div>
  );
}
