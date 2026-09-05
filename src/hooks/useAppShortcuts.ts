import { useEffect } from "react";

type AppShortcutHandlers = {
  onQuickNote: () => void;
};

export function useAppShortcuts({ onQuickNote }: AppShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onQuickNote();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onQuickNote]);
}
