import { useCallback, useState } from "react";
import Sidebar, {
  type SidebarView,
  type View,
} from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import QuickNoteModal from "./components/QuickNoteModal";
import Toast from "./components/Toast";
import { getDb, type AppDb } from "./db/appDb";
import { useAppShortcuts } from "./hooks/useAppShortcuts";
import { createDraftStore } from "./lib/drafts";
import type { Initiative, Person } from "./lib/types";
import BugunView from "./views/BugunView";
import InitiativeDetailView from "./views/InitiativeDetailView";
import InitiativesView from "./views/InitiativesView";
import NotesView from "./views/NotesView";
import PeopleView from "./views/PeopleView";
import PersonDetailView from "./views/PersonDetailView";
import SearchView from "./views/SearchView";
import TrashView from "./views/TrashView";

type AppProps = {
  db?: AppDb;
};

export default function App({ db }: AppProps = {}) {
  const appDb = db ?? getDb();
  const [activeView, setActiveView] = useState<View>("bugun");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [searchFocusRequestKey, setSearchFocusRequestKey] = useState(0);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedInitiative, setSelectedInitiative] =
    useState<Initiative | null>(null);
  const [draftStore] = useState(createDraftStore);

  const changeView = useCallback((view: SidebarView) => {
    setActiveView(view);
  }, []);

  const openQuickNote = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuickNoteOpen(true);
  }, []);
  const openCommandPalette = useCallback(() => {
    setQuickNoteOpen(false);
    setCommandPaletteOpen(true);
  }, []);
  const closeOverlays = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuickNoteOpen(false);
  }, []);
  const openSearch = useCallback(() => {
    setActiveView("arama");
    setSearchFocusRequestKey((key) => key + 1);
  }, []);
  const showToast = useCallback((message: string) => setToast(message), []);
  useAppShortcuts({
    onClose: closeOverlays,
    onCommandPalette: openCommandPalette,
    onNavigate: changeView,
    onQuickNote: openQuickNote,
    onSearch: openSearch,
  });

  const openPerson = (person: Person) => {
    setSelectedPerson(person);
    setActiveView("kisi:");
  };

  const openInitiative = (initiative: Initiative) => {
    setSelectedInitiative(initiative);
    setActiveView("is:");
  };

  const renderView = () => {
    switch (activeView) {
      case "bugun":
        return <BugunView db={appDb} />;
      case "notlar":
        return (
          <NotesView
            db={appDb}
            onToast={showToast}
            refreshKey={notesRefreshKey}
          />
        );
      case "kisiler":
        return (
          <PeopleView
            db={appDb}
            onSelectPerson={openPerson}
            onToast={showToast}
          />
        );
      case "isler":
        return (
          <InitiativesView
            db={appDb}
            onSelectInitiative={openInitiative}
            onToast={showToast}
          />
        );
      case "arama":
        return (
          <SearchView
            db={appDb}
            focusRequestKey={searchFocusRequestKey}
          />
        );
      case "silinenler":
        return <TrashView />;
      case "kisi:":
        return selectedPerson ? (
          <PersonDetailView
            db={appDb}
            onBack={() => setActiveView("kisiler")}
            onToast={showToast}
            person={selectedPerson}
          />
        ) : (
          <PeopleView
            db={appDb}
            onSelectPerson={openPerson}
            onToast={showToast}
          />
        );
      case "is:":
        return selectedInitiative ? (
          <InitiativeDetailView
            db={appDb}
            initiative={selectedInitiative}
            onBack={() => setActiveView("isler")}
            onToast={showToast}
          />
        ) : (
          <InitiativesView
            db={appDb}
            onSelectInitiative={openInitiative}
            onToast={showToast}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onViewChange={changeView} />
      <main className="content">{renderView()}</main>
      {quickNoteOpen ? (
        <QuickNoteModal
          db={appDb}
          draftStore={draftStore}
          onClose={() => setQuickNoteOpen(false)}
          onSaved={() => setNotesRefreshKey((key) => key + 1)}
          onToast={showToast}
        />
      ) : null}
      {commandPaletteOpen ? (
        <CommandPalette
          db={appDb}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigate={changeView}
          onOpenInitiative={openInitiative}
          onOpenPerson={openPerson}
          onQuickNote={openQuickNote}
        />
      ) : null}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
