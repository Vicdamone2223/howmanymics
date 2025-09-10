'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type U = {
  id?: number;
  title: string;
  slug: string;
  cover_url: string | null;
  release_date: string | null; // yyyy-mm-dd
  status: 'confirmed'|'rumor'|'delayed';
  notes: string | null;
};

function slugify(s:string){return (s||'').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-')}

export default function EditUpcoming() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const isNew = id === 'new';

  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [row, setRow] = useState<U>({
    title:'', slug:'', cover_url:'', release_date:'', status:'rumor', notes:''
  });

  useEffect(()=>{ (async()=>{
    const { data: meAdmin } = await supabase.rpc('me_is_admin');
    if (!meAdmin) { setOk(false); setLoading(false); return; }
    setOk(true);
    if (!isNew) {
      const num = Number(id);
      const { data } = await supabase.from('upcoming_albums').select('*').eq('id', num).single();
      if (!data) { setErr('Not found'); setLoading(false); return; }
      setRow({
        id: data.id,
        title: data.title,
        slug: data.slug,
        cover_url: data.cover_url,
        release_date: data.release_date,
        status: data.status,
        notes: data.notes
      });
    }
    setLoading(false);
  })(); },[id,isNew]);

  const canSave = useMemo(()=>row.title.trim().length>0, [row.title]);

  async function save(e:React.FormEvent){
    e.preventDefault(); setErr(null);
    const payload = {
      ...row,
      slug: slugify(row.slug || row.title),
      cover_url: row.cover_url?.trim() || null,
      notes: row.notes || null,
      release_date: row.release_date || null
    };
    if (isNew) {
      const { data, error } = await supabase.from('upcoming_albums').insert(payload).select('id').single();
      if (error) { setErr(error.message); return; }
      alert('Created'); router.push(`/admin/calendar/${data!.id}`);
    } else {
      const { error } = await supabase.from('upcoming_albums').update(payload).eq('id', row.id!);
      if (error) { setErr(error.message); return; }
      alert('Saved');
    }
  }

  async function destroy(){
    if (isNew || !row.id) return;
    if (!confirm('Delete this item?')) return;
    const { error } = await supabase.from('upcoming_albums').delete().eq('id', row.id);
    if (error) { alert(error.message); return; }
    router.push('/admin/calendar');
  }

  if (ok === null) return <main className="mx-auto max-w-4xl px-4 py-8">Checking…</main>;
  if (ok === false) return <main className="mx-auto max-w-4xl px-4 py-8">No access.</main>;
  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{isNew ? 'New Calendar Item' : 'Edit Calendar Item'}</h1>
        {!isNew && (
          <button onClick={destroy} className="text-sm px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900/20">Delete</button>
        )}
      </div>
      {err && <div className="mb-4 text-sm rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-300">{err}</div>}

      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="input" placeholder="Title" value={row.title} onChange={e=>setRow(r=>({...r,title:e.target.value}))} required/>
        <input className="input" placeholder="Slug" value={row.slug} onChange={e=>setRow(r=>({...r,slug:e.target.value}))}/>
        <input className="input sm:col-span-2" placeholder="Cover URL" value={row.cover_url ?? ''} onChange={e=>setRow(r=>({...r,cover_url:e.target.value}))}/>
        <input className="input" type="date" value={row.release_date ?? ''} onChange={e=>setRow(r=>({...r,release_date:e.target.value}))}/>
        <select className="input" value={row.status} onChange={e=>setRow(r=>({...r,status:e.target.value as any}))}>
          <option value="confirmed">Confirmed</option>
          <option value="rumor">Rumor</option>
          <option value="delayed">Delayed</option>
        </select>
        <textarea className="input sm:col-span-2 min-h-40" placeholder="Notes (optional)" value={row.notes ?? ''} onChange={e=>setRow(r=>({...r,notes:e.target.value}))}/>
        <div className="sm:col-span-2 mt-2">
          <button className="btn" type="submit" disabled={!canSave}>Save</button>
          <a href="/admin/calendar" className="ml-2 text-sm opacity-80 hover:opacity-100 underline">Back</a>
        </div>
      </form>

      <style jsx>{`
        .input{background:#0a0a0a;border:1px solid #27272a;border-radius:.5rem;padding:.5rem .75rem;color:#f4f4f5}
        .btn{background:#f97316;color:#000;font-weight:700;border-radius:.5rem;padding:.6rem .9rem}
      `}</style>
    </main>
  );
}
