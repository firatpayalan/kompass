import { useEffect } from "react";

type AppShortcutHandlers = {
  onClose: () => void;
  onCommandPalette: () => void;
  onNavigate: (view: "bugun" | "notlar" | "kisiler" | "isler") => void;
  onQuickNote: () => void;
  onSearch: () => void;
};

export function useAppShortcuts({
  onClose,
  onCommandPalette,
  onNavigate,
  onQuickNote,
  onSearch,
}: AppShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (!event.metaKey || event.altKey || event.ctrlKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const numberedViews = {
        "1": "bugun",
        "2": "notlar",
        "3": "kisiler",
        "4": "isler",
      } as const;

      if (key === "n") {
        event.preventDefault();
        onQuickNote();
      } else if (key === "k") {
        event.preventDefault();
        onCommandPalette();
      } else if (key === "f") {
        event.preventDefault();
        onSearch();
      } else if (key in numberedViews) {
        event.preventDefault();
        onNavigate(numberedViews[key as keyof typeof numberedViews]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onCommandPalette, onNavigate, onQuickNote, onSearch]);
}
