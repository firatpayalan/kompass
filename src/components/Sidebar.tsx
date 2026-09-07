import { useEffect, useState } from "react";

import {
  formatVersionLabel,
  resolveAppVersion,
} from "../lib/appVersion";

export type View =
  | "bugun"
  | "gelen"
  | "notlar"
  | "kisiler"
  | "isler"
  | "hafta"
  | "ayarlar"
  | "arama"
  | "arsiv"
  | "kisi:"
  | "is:";

export type SidebarView = Exclude<View, "kisi:" | "is:">;

interface SidebarProps {
  activeView: View;
  onViewChange: (view: SidebarView) => void;
  /** Optional override (tests); otherwise loaded via resolveAppVersion. */
  version?: string;
}

const navigationItems: Array<{ view: SidebarView; label: string }> = [
  { view: "bugun", label: "Bugün" },
  { view: "gelen", label: "Gelen" },
  { view: "notlar", label: "Notlar" },
  { view: "kisiler", label: "Kişiler" },
  { view: "isler", label: "İşler" },
  { view: "hafta", label: "Hafta" },
  { view: "ayarlar", label: "Ayarlar" },
  { view: "arama", label: "Arama" },
  { view: "arsiv", label: "Arşiv" },
];

export default function Sidebar({
  activeView,
  onViewChange,
  version: versionProp,
}: SidebarProps) {
  const [version, setVersion] = useState(versionProp ?? "");

  useEffect(() => {
    if (versionProp !== undefined) {
      setVersion(versionProp);
      return;
    }
    let cancelled = false;
    void resolveAppVersion().then((resolved) => {
      if (!cancelled) {
        setVersion(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [versionProp]);

  const label = formatVersionLabel(version);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__title">Kompass</div>
        {label ? (
          <p aria-label="Uygulama sürümü" className="sidebar__version">
            {label}
          </p>
        ) : null}
      </div>
      <nav aria-label="Ana menü">
        {navigationItems.map(({ view, label: itemLabel }) => (
          <button
            aria-current={activeView === view ? "page" : undefined}
            className="sidebar__item"
            key={view}
            onClick={() => onViewChange(view)}
            type="button"
          >
            {itemLabel}
          </button>
        ))}
      </nav>
    </aside>
  );
}
