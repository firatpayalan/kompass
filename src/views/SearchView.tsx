import { useEffect, useRef, useState } from "react";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Note } from "../lib/types";
import NoteTimestamps from "../components/NoteTimestamps";

type SearchDb = Pick<AppDb, "searchNotes">;

type SearchViewProps = {
  db?: SearchDb;
  focusRequestKey?: number;
};

export default function SearchView({
  db = getDb(),
  focusRequestKey = 0,
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
        <ul aria-label="Arama sonuçları" className="search-results">
          {results.map((note) => (
            <li key={note.id}>
              <p>{note.body}</p>
              {note.tags.length > 0 ? (
                <div className="note-list__tags">
                  {note.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
              ) : null}
              <NoteTimestamps note={note} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
