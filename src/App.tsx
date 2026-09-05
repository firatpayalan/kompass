import { useState, type ReactNode } from "react";
import Sidebar, {
  type SidebarView,
  type View,
} from "./components/Sidebar";
import BugunView from "./views/BugunView";
import InitiativeDetailView from "./views/InitiativeDetailView";
import InitiativesView from "./views/InitiativesView";
import NotesView from "./views/NotesView";
import PeopleView from "./views/PeopleView";
import PersonDetailView from "./views/PersonDetailView";
import SearchView from "./views/SearchView";
import TrashView from "./views/TrashView";

const views: Record<View, ReactNode> = {
  bugun: <BugunView />,
  notlar: <NotesView />,
  kisiler: <PeopleView />,
  isler: <InitiativesView />,
  arama: <SearchView />,
  silinenler: <TrashView />,
  "kisi:": <PersonDetailView />,
  "is:": <InitiativeDetailView />,
};

export default function App() {
  const [activeView, setActiveView] = useState<View>("bugun");

  const changeView = (view: SidebarView) => {
    setActiveView(view);
  };

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onViewChange={changeView} />
      <main className="content">{views[activeView]}</main>
    </div>
  );
}
