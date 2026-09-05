export type View =
  | "bugun"
  | "gelen"
  | "notlar"
  | "kisiler"
  | "isler"
  | "arama"
  | "arsiv"
  | "kisi:"
  | "is:";

export type SidebarView = Exclude<View, "kisi:" | "is:">;

interface SidebarProps {
  activeView: View;
  onViewChange: (view: SidebarView) => void;
}

const navigationItems: Array<{ view: SidebarView; label: string }> = [
  { view: "bugun", label: "Bugün" },
  { view: "gelen", label: "Gelen" },
  { view: "notlar", label: "Notlar" },
  { view: "kisiler", label: "Kişiler" },
  { view: "isler", label: "İşler" },
  { view: "arama", label: "Arama" },
  { view: "arsiv", label: "Arşiv" },
];

export default function Sidebar({
  activeView,
  onViewChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__title">Günlük Liderlik</div>
      <nav aria-label="Ana menü">
        {navigationItems.map(({ view, label }) => (
          <button
            aria-current={activeView === view ? "page" : undefined}
            className="sidebar__item"
            key={view}
            onClick={() => onViewChange(view)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
