import { useEffect, useMemo, useState } from 'react';
import { AtlasCanvas } from './AtlasCanvas';
import type { Manifest, Mode, Point, SearchEntry } from './types';

export function App() {
  const [mode, setMode] = useState<Mode>('media');
  const [lang, setLang] = useState<'en' | 'native'>('en');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [search, setSearch] = useState<SearchEntry[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SearchEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dataBase = `${import.meta.env.BASE_URL}data`;

  useEffect(() => {
    const load = async () => {
      try {
        const [manifestRes, pointsRes, searchRes] = await Promise.all([
          fetch(`${dataBase}/manifest.json`),
          fetch(`${dataBase}/points.json`),
          fetch(`${dataBase}/index/search.json`),
        ]);

        if (!manifestRes.ok || !pointsRes.ok || !searchRes.ok) {
          throw new Error(`Artifact fetch failed (${manifestRes.status}/${pointsRes.status}/${searchRes.status})`);
        }

        const manifestPayload = await manifestRes.json();
        const pointsPayload = await pointsRes.json();
        const searchPayload = await searchRes.json();

        setManifest(manifestPayload);
        setPoints(pointsPayload.points ?? []);
        setSearch(searchPayload.entries ?? []);
      } catch (error: any) {
        setLoadError(String(error?.message ?? error));
      }
    };

    void load();
  }, [dataBase]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return search
      .filter((entry) => (mode === 'media' ? entry.kind === 'media' : entry.kind === 'person'))
      .filter((entry) => entry.label_en.toLowerCase().includes(q) || entry.label_native.toLowerCase().includes(q))
      .slice(0, 16);
  }, [mode, query, search]);

  return (
    <div className="shell">
      <header>
        <h1>Anime Atlas</h1>
        <div className="controls">
          <button onClick={() => setMode('media')} className={mode === 'media' ? 'active' : ''}>Media</button>
          <button onClick={() => setMode('people')} className={mode === 'people' ? 'active' : ''}>People</button>
          <button onClick={() => setLang((p) => (p === 'en' ? 'native' : 'en'))}>{lang === 'en' ? 'EN' : 'JP'}</button>
        </div>
      </header>
      {loadError && <div className="banner">Failed to load local artifacts: {loadError}</div>}
      {manifest && (!manifest.has_staff_for_all_media || !manifest.has_characters_for_all_media) && (
        <div className="banner">Data still ingesting: atlas is partial but usable.</div>
      )}
      <main>
        <aside>
          <h3>Search</h3>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search media/people" />
          {filtered.map((f) => (
            <button key={`${f.kind}-${f.id}`} className="result" onClick={() => setSelected(f)}>
              {lang === 'en' ? f.label_en : f.label_native || f.label_en}
            </button>
          ))}
          <h3>Talent Finder</h3>
          <p>Filter by role/tag in People mode with graph overlays from collaborator and role indices.</p>
        </aside>
        <AtlasCanvas
          points={points}
          mode={mode}
          onSelect={(id, kind) => setSelected(search.find((s) => s.id === id && s.kind === (kind === 0 ? 'media' : 'person')) ?? null)}
        />
        <section className="drawer">
          <h3>Details</h3>
          {selected ? (
            <>
              <h4>{lang === 'en' ? selected.label_en : selected.label_native || selected.label_en}</h4>
              <p>Type: {selected.kind}</p>
              {selected.year ? <p>Year: {selected.year}</p> : null}
              <p>Actions: Explore connections (1/2/3 hops), find similar, focus on map.</p>
            </>
          ) : (
            <p>Select a node to explore.</p>
          )}
        </section>
      </main>
    </div>
  );
}
