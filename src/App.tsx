import { useCallback, useState } from "react";
import Sidebar, {
  type SidebarView,
  type View,
} from "./components/Sidebar";
import QuickNoteModal from "./components/QuickNoteModal";
import Toast from "./components/Toast";
import { getDb } from "./db/appDb";
import { useAppShortcuts } from "./hooks/useAppShortcuts";
import { createDraftStore } from "./lib/drafts";
import BugunView from "./views/BugunView";
import InitiativeDetailView from "./views/InitiativeDetailView";
import InitiativesView from "./views/InitiativesView";
import NotesView from "./views/NotesView";
import PeopleView from "./views/PeopleView";
import PersonDetailView from "./views/PersonDetailView";
import SearchView from "./views/SearchView";
import TrashView from "./views/TrashView";

export default function App() {
  const [activeView, setActiveView] = useState<View>("bugun");
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [draftStore] = useState(createDraftStore);

  const changeView = (view: SidebarView) => {
    setActiveView(view);
  };

  const openQuickNote = useCallback(() => setQuickNoteOpen(true), []);
  const showToast = useCallback((message: string) => setToast(message), []);
  useAppShortcuts({ onQuickNote: openQuickNote });

  const renderView = () => {
    switch (activeView) {
      case "bugun":
        return <BugunView />;
      case "notlar":
        return (
          <NotesView
            onToast={showToast}
            refreshKey={notesRefreshKey}
          />
        );
      case "kisiler":
        return <PeopleView />;
      case "isler":
        return <InitiativesView />;
      case "arama":
        return <SearchView />;
      case "silinenler":
        return <TrashView />;
      case "kisi:":
        return <PersonDetailView />;
      case "is:":
        return <InitiativeDetailView />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onViewChange={changeView} />
      <main className="content">{renderView()}</main>
      {quickNoteOpen ? (
        <QuickNoteModal
          db={getDb()}
          draftStore={draftStore}
          onClose={() => setQuickNoteOpen(false)}
          onSaved={() => setNotesRefreshKey((key) => key + 1)}
          onToast={showToast}
        />
      ) : null}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
