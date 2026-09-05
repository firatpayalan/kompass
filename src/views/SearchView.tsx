import { useEffect, useRef, useState } from "react";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Note } from "../lib/types";
import NoteArchiveShell from "../components/NoteArchiveShell";
import NoteBodyView from "../components/NoteBodyView";
import NoteTagBadges from "../components/NoteTagBadges";
import NoteTimestamps from "../components/NoteTimestamps";

type SearchDb = Pick<
  AppDb,
  "searchNotes" | "softDeleteNote" | "getNoteImage"
>;

type SearchViewProps = {
  db?: SearchDb;
  focusRequestKey?: number;
  onToast?: (message: string) => void;
};

const ignoreToast = () => undefined;

export default function SearchView({
  db = getDb(),
  focusRequestKey = 0,
  onToast = ignoreToast,
}: SearchViewProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusRequestKey]);

  useEffect(() => {
    let active = true;
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setFailed(false);
    void db.searchNotes(trimmedQuery).then(
      (notes) => {
        if (active) {
          setResults(notes);
          setLoading(false);
        }
      },
      () => {
        if (active) {
          setResults([]);
          setLoading(false);
          setFailed(true);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [db, query]);

  const archiveNote = async (noteId: number) => {
    try {
      await db.softDeleteNote(noteId, new Date().toISOString());
      setResults((prev) => prev.filter((note) => note.id !== noteId));
      onToast("Not arşivlendi");
    } catch {
      onToast("Not arşivlenemedi");
    }
  };

  return (
    <section className="search-view">
      <h1>Arama</h1>
      <label>
        Notlarda ara
        <input
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Metin, etiket, kişi veya iş ara…"
          ref={inputRef}
          type="search"
          value={query}
        />
      </label>
      {!query.trim() ? <p>Aramak için yazmaya başlayın.</p> : null}
      {loading ? <p>Aranıyor…</p> : null}
      {failed ? <p>Arama yapılamadı.</p> : null}
      {!loading && !failed && query.trim() && results.length === 0 ? (
        <p>Sonuç bulunamadı.</p>
      ) : null}
      {results.length > 0 ? (
        <NoteArchiveShell enabled onArchive={archiveNote}>
          {({ openArchiveMenu }) => (
            <ul aria-label="Arama sonuçları" className="search-results">
              {results.map((note) => (
                <li
                  key={note.id}
                  onContextMenu={(event) => openArchiveMenu(event, note)}
                >
                  <NoteBodyView
                    body={note.body}
                    getNoteImage={(id) => db.getNoteImage(id)}
                  />
                  <NoteTagBadges tags={note.tags} />
                  <NoteTimestamps note={note} />
                </li>
              ))}
            </ul>
          )}
        </NoteArchiveShell>
      ) : null}
    </section>
  );
}
