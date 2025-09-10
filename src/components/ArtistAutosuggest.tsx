'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type ArtistRow = { id: number; name: string; slug: string };

type Props = {
  label: string;
  placeholder?: string;
  selected: ArtistRow | null;
  onSelect: (artist: ArtistRow | null) => void;
  excludeIds?: number[]; // optional: don't suggest IDs already chosen elsewhere
};

export default function ArtistAutosuggest({
  label,
  placeholder = 'Type artist name…',
  selected,
  onSelect,
  excludeIds = [],
}: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ArtistRow[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debRef = useRef<number | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (selected) {
      setQ(selected.name);
      setResults([]);
      setOpen(false);
      return;
    }
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('artists')
          .select('id,name,slug')
          .ilike('name', `%${q.trim()}%`)
          .order('name', { ascending: true })
          .limit(8);
        if (!error && data) {
          const filtered = data.filter((a) => !excludeIds.includes(Number(a.id)));
          setResults(filtered as ArtistRow[]);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, selected, excludeIds.join(',')]);

  return (
    <div className="sm:col-span-2 relative" ref={wrapRef}>
      <label className="block text-xs opacity-70 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={selected ? selected.name : q}
          onChange={(e) => { onSelect(null); setQ(e.target.value); }}
          onFocus={() => { if (!selected && results.length > 0) setOpen(true); }}
        />
        {selected && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900"
            onClick={() => { onSelect(null); setQ(''); setOpen(false); }}
            title="Clear"
          >
            Clear
          </button>
        )}
      </div>

      {open && !selected && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm opacity-70">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm opacity-70">No matches</div>
          ) : (
            <ul className="max-h-64 overflow-auto">
              {results.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-zinc-900"
                    onClick={() => { onSelect({ id: Number(a.id), name: a.name, slug: a.slug }); setOpen(false); }}
                  >
                    {a.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
