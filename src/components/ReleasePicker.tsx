'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ReleaseHit = {
  id: number;
  title: string;
  slug: string;
  year: number | null;
  cover_url: string | null;
};

export default function ReleasePicker({
  value,
  onChange,
}: {
  /** Selected release id as a string ('' if none) */
  value: string;
  /** Called with the selected release id as a string */
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [results, setResults] = useState<ReleaseHit[]>([]);
  const [selected, setSelected] = useState<ReleaseHit | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch current selection details when value changes (to show a chip)
  useEffect(() => {
    (async () => {
      if (!value) {
        setSelected(null);
        return;
      }
      const id = Number(value);
      if (!Number.isFinite(id)) return;
      const { data, error } = await supabase
        .from('releases')
        .select('id,title,slug,year,cover_url')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        setSelected(data as ReleaseHit);
      }
    })();
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      setErrMsg(null);
      return;
    }
    timerRef.current = setTimeout(runSearch, 250);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function runSearch() {
    const term = q.trim();
    if (!term) return;

    // cancel previous request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setErrMsg(null);
    setResults([]);
    try {
      // Search title OR slug (case-insensitive)
      const pattern = `%${term}%`;
      const { data, error } = await supabase
        .from('releases')
        .select('id,title,slug,year,cover_url')
        .or(`title.ilike.${pattern},slug.ilike.${pattern}`)
        .order('year', { ascending: false })
        .limit(15);

      if (error) {
        console.error('ReleasePicker search error:', error);
        setErrMsg('Search unavailable right now.');
        setResults([]);
      } else {
        setResults((data || []) as ReleaseHit[]);
      }
    } catch (e: unknown) {
      // ignore aborts; surface other errors
      const isAbort =
        (typeof e === 'object' &&
          e !== null &&
          'name' in e &&
          (e as { name?: string }).name === 'AbortError');
      if (!isAbort) {
        console.error('ReleasePicker search failed:', e);
        setErrMsg('Search failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  function choose(r: ReleaseHit) {
    onChange(String(r.id));
    setSelected(r);
    setQ('');
    setResults([]);
  }

  function clearSelection() {
    onChange('');
    setSelected(null);
    setQ('');
    setResults([]);
  }

  const showDropdown = useMemo(
    () => q.trim().length > 0 && (loading || results.length > 0 || errMsg),
    [q, loading, results.length, errMsg]
  );

  return (
    <div className="relative">
      {/* Selected pill */}
      {selected ? (
        <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.cover_url || '/placeholder/cover1.jpg'}
            alt={selected.title}
            className="h-6 w-6 rounded object-cover border border-zinc-800"
          />
          <span className="opacity-90">
            {selected.title} {selected.year ? `(${selected.year})` : ''} —{' '}
            <code className="opacity-100">/{selected.slug}</code>
          </span>
          <button
            type="button"
            className="ml-2 text-xs px-2 py-0.5 rounded border border-zinc-700 hover:bg-zinc-900"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            Clear
          </button>
        </div>
      ) : null}

      {/* Search box */}
      <input
        className="input w-full"
        placeholder="Search albums by title or slug…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          {loading && <div className="px-3 py-2 text-sm opacity-70">Searching…</div>}
          {!loading && errMsg && <div className="px-3 py-2 text-sm text-red-300">{errMsg}</div>}
          {!loading && !errMsg && results.length === 0 && (
            <div className="px-3 py-2 text-sm opacity-70">No matches.</div>
          )}
          {!loading && !errMsg && results.length > 0 && (
            <ul className="max-h-72 overflow-auto divide-y divide-zinc-800">
              {results.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-2 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.cover_url || '/placeholder/cover1.jpg'}
                    alt={r.title}
                    className="h-10 w-10 rounded object-cover border border-zinc-800"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      <strong>{r.title}</strong>{' '}
                      {r.year ? <span className="opacity-70">({r.year})</span> : null}
                    </div>
                    <div className="text-xs opacity-70 truncate">/{r.slug}</div>
                  </div>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 shrink-0"
                    onClick={() => choose(r)}
                  >
                    Select
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style jsx>{`
        .input {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #f4f4f5;
          outline: none;
        }
        .input::placeholder {
          color: #a1a1aa;
        }
        .input:focus {
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.35);
        }
      `}</style>
    </div>
  );
}
