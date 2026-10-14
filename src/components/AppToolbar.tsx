import type { View } from "./Sidebar";
import Icon from "./Icon";

const labels: Record<View, string> = {
  bugun: "Bugün",
  gelen: "Gelen",
  notlar: "Notlar",
  yapilacaklar: "Yapılacaklar",
  kisiler: "Kişiler",
  isler: "İşler",
  hafta: "Hafta",
  ayarlar: "Ayarlar",
  arama: "Arama",
  arsiv: "Arşiv",
  "kisi:": "Kişiler",
  "is:": "İşler",
};

type AppToolbarProps = {
  activeView: View;
  detail?: string;
  onSearch: () => void;
  onQuickNote: () => void;
};

export default function AppToolbar({ activeView, detail, onSearch, onQuickNote }: AppToolbarProps) {
  const modifier = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

  return (
    <header className="app-toolbar">
      <div className="app-toolbar__breadcrumb">
        <span className="app-toolbar__workspace">Çalışma alanı</span>
        <Icon name="chevron" size={13} />
        <span>{labels[activeView]}</span>
        {detail ? (
          <>
            <Icon name="chevron" size={13} />
            <span className="app-toolbar__detail">{detail}</span>
          </>
        ) : null}
      </div>
      <div className="app-toolbar__actions">
        <button
          className="app-toolbar__search"
          aria-label="Komut paletini aç"
          onClick={onSearch}
          type="button"
        >
          <Icon name="search" size={16} />
          <span>Hızlı ara…</span>
          <kbd aria-hidden="true">{modifier} K</kbd>
        </button>
        <button className="app-toolbar__capture" onClick={onQuickNote} type="button">
          <Icon name="plus" size={17} />
          <span>Hızlı not</span>
          <kbd aria-hidden="true">{modifier} N</kbd>
        </button>
      </div>
    </header>
  );
}
