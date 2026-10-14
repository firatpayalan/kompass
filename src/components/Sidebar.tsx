import { useEffect, useState } from "react";
import Icon, { type IconName } from "./Icon";

import {
  formatVersionLabel,
  resolveAppVersion,
} from "../lib/appVersion";

export type View =
  | "bugun"
  | "gelen"
  | "notlar"
  | "yapilacaklar"
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

const navigationItems: Array<{ view: SidebarView; label: string; icon: IconName; group: string }> = [
  { view: "bugun", label: "Bugün", icon: "today", group: "Çalışma alanı" },
  { view: "gelen", label: "Gelen", icon: "inbox", group: "Çalışma alanı" },
  { view: "notlar", label: "Notlar", icon: "note", group: "Çalışma alanı" },
  { view: "yapilacaklar", label: "Yapılacaklar", icon: "todo", group: "Çalışma alanı" },
  { view: "kisiler", label: "Kişiler", icon: "people", group: "Takım ve işler" },
  { view: "isler", label: "İşler", icon: "briefcase", group: "Takım ve işler" },
  { view: "hafta", label: "Hafta", icon: "calendar", group: "Takım ve işler" },
  { view: "arama", label: "Arama", icon: "search", group: "Diğer" },
  { view: "arsiv", label: "Arşiv", icon: "archive", group: "Diğer" },
  { view: "ayarlar", label: "Ayarlar", icon: "settings", group: "Diğer" },
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
        <span className="sidebar__mark"><Icon name="compass" size={27} /></span>
        <div>
          <div className="sidebar__title">Kompass</div>
          {label ? <p aria-label="Uygulama sürümü" className="sidebar__version">{label}</p> : null}
        </div>
      </div>
      <nav aria-label="Ana menü">
        {["Çalışma alanı", "Takım ve işler", "Diğer"].map((group) => (
          <div className={`sidebar__group${group === "Diğer" ? " sidebar__group--secondary" : ""}`} key={group}>
            <p className="sidebar__group-label">{group}</p>
            {navigationItems.filter((item) => item.group === group).map(({ view, label: itemLabel, icon }) => {
              const selected = activeView === view || (activeView === "kisi:" && view === "kisiler") || (activeView === "is:" && view === "isler");
              return <button aria-current={selected ? "page" : undefined} className="sidebar__item" data-view={view}
                key={view} onClick={() => onViewChange(view)} type="button">
                <Icon name={icon} /><span>{itemLabel}</span>
                {selected ? <span className="sidebar__active-dot" aria-hidden="true" /> : null}
              </button>;
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar__footer"><Icon name="compass" size={17} /><div><strong>Kendi rotanızda.</strong><span>Yerel çalışma alanınız</span></div></div>
    </aside>
  );
}
