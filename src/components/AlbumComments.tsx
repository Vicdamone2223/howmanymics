'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type C = { id:number; body:string; created_at:string; user_id:string };

export default function AlbumComments({ releaseId }:{ releaseId:number|string }) {
  const [rows, setRows] = useState<C[]>([]);
  const [mine, setMine] = useState<string | null>(null);
  const [body, setBody] = useState('');

  useEffect(()=>{(async()=>{
    const me = await supabase.auth.getUser();
    setMine(me.data.user?.id ?? null);

    const { data } = await supabase
      .from('release_comments')
      .select('id,body,created_at,user_id')
      .eq('release_id', releaseId)
      .order('created_at',{ascending:false})
      .limit(50);
    setRows((data||[]) as C[]);
  })();},[releaseId]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    const user = await supabase.auth.getUser();
    const uid = user.data.user?.id;
    if (!uid) { alert('Sign in to comment.'); return; }
    const txt = body.trim(); if (!txt) return;

    const { data, error } = await supabase
      .from('release_comments')
      .insert({ release_id: releaseId, user_id: uid, body: txt })
      .select('id,body,created_at,user_id')
      .single();
    if (error) { alert(error.message); return; }
    setRows([data as C, ...rows]);
    setBody('');
  }

  async function del(id:number){
    const { error } = await supabase.from('release_comments').delete().eq('id', id);
    if (!error) setRows(rows.filter(r => r.id !== id));
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex items-start gap-2">
        <textarea
          className="input flex-1 min-h-[60px]"
          placeholder="What did you think of this album?"
          value={body}
          onChange={e=>setBody(e.target.value)}
        />
        <button className="btn" type="submit">Post</button>
      </form>

      {!rows.length ? (
        <p className="opacity-70 text-sm">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(c => (
            <li key={c.id} className="rounded border border-zinc-800 p-3">
              <div className="text-xs opacity-70 mb-1">
                {new Date(c.created_at).toLocaleString()}
              </div>
              <p className="text-sm leading-relaxed">{c.body}</p>
              {mine && mine === c.user_id && (
                <button className="mt-1 text-xs underline opacity-70 hover:opacity-100"
                        onClick={()=>del(c.id)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
