// scripts/ingest-artist.mjs
// Imports **official studio albums only** by default (no singles/EPs/compilations/live).
// Flags:
//   --include-mixtapes       also import "Mixtape/Street"
//   --include-compilations   also import "Compilation"
//   --dry-run                preview only; no DB writes
// Safe de-dupe, track features, and primary album credit via release_artists.
// Only runs when invoked from CLI (guarded).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------- ENV loader --------
for (const root of [process.cwd(), path.resolve(__dirname, '..'), path.resolve(__dirname, '..', '..')]) {
  for (const fname of ['.env.local', '.env']) {
    const p = path.join(root, fname);
    if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
  }
}
const trim = (k) => (typeof process.env[k] === 'string' ? process.env[k].trim() : undefined);
const SUPABASE_URL = trim('SUPABASE_URL') || trim('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE  = trim('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// -------- CLI flags --------
const argv = process.argv.slice(2);
const nameArg = argv.filter(a => !a.startsWith('--')).join(' ').trim();
const includeMixtapes = argv.includes('--include-mixtapes');
const includeCompilations = argv.includes('--include-compilations');
const dryRun = argv.includes('--dry-run');

// -------- utils --------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const msToSeconds = (ms) => {
  if (ms == null) return null;
  const n = Number(ms);
  return Number.isFinite(n) ? Math.round(n / 1000) : null;
};
function slugify(s = '') {
  return s.toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}
async function mbGET(pathPart, params = {}) {
  const qs = new URLSearchParams({ fmt: 'json', ...params }).toString();
  const url = `https://musicbrainz.org/ws/2/${pathPart}?${qs}`;
  await sleep(1100); // polite MB rate limit
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HowManyMics/1.0 (contact: admin@example.com)' },
  });
  if (!res.ok) throw new Error(`MB ${res.status} ${res.statusText} ${url}`);
  return res.json();
}

// -------- artist de-dupe helpers --------
async function findArtistByMBID(mbid) {
  if (!mbid) return null;
  const { data, error } = await sb.from('artists')
    .select('id,name,slug,mbid')
    .eq('mbid', mbid)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
async function findArtistBySlugOrName(name) {
  const slug = slugify(name);
  {
    const { data, error } = await sb.from('artists')
      .select('id,name,slug,mbid')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  {
    const { data, error } = await sb.from('artists')
      .select('id,name,slug,mbid')
      .ilike('name', name);
    if (error) throw error;
    if (data && data.length) return data[0];
  }
  return null;
}
async function ensureArtist(mbArtist) {
  const mbid = mbArtist.id;
  const name = mbArtist.name;

  let found = await findArtistByMBID(mbid);
  if (found) return found;

  found = await findArtistBySlugOrName(name);
  if (found) {
    if (!found.mbid && !dryRun) {
      const { error: upErr } = await sb.from('artists').update({ mbid }).eq('id', found.id);
      if (upErr) throw upErr;
    }
    return found;
  }

  const payload = { name, slug: slugify(name), mbid };
  if (dryRun) return { id: 'DRY', ...payload };

  const { data: inserted, error } = await sb.from('artists')
    .insert(payload)
    .select('id,name,slug,mbid')
    .single();
  if (error) throw error;
  return inserted;
}

// -------- release/track upserts --------
async function upsertRelease(artistId, title, year) {
  let slug = slugify(title);

  // Try slug
  {
    const { data } = await sb.from('releases').select('id').eq('slug', slug).maybeSingle();
    if (data) return data.id;
  }
  // Try slug-year
  if (year) {
    const slug2 = `${slug}-${year}`;
    const { data } = await sb.from('releases').select('id').eq('slug', slug2).maybeSingle();
    if (data) return data.id;
    slug = slug2;
  }

  if (dryRun) return `DRY_${slug}`;

  const { data, error } = await sb.from('releases')
    .insert({ title, slug, artist_id: artistId, year: year ?? null })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function ensurePrimaryReleaseArtist(releaseId, artistId) {
  if (dryRun) return true;
  // ensure there is a primary credit in release_artists so artist pages show the album
  const { error } = await sb
    .from('release_artists')
    .upsert(
      { release_id: releaseId, artist_id: Number(artistId), position: 1, is_primary: true },
      { onConflict: 'release_id,artist_id' }
    );
  if (error) throw error;
  return true;
}

async function upsertTrack(releaseId, trackNo, title, durationSeconds) {
  if (dryRun) return `DRY_TRACK_${releaseId}_${trackNo}`;

  const { data: existing, error: exErr } = await sb.from('tracks')
    .select('id')
    .eq('release_id', releaseId)
    .eq('track_no', trackNo)
    .maybeSingle();
  if (exErr) throw exErr;

  if (existing) {
    const { data: upd, error: upErr } = await sb.from('tracks')
      .update({ title, duration_seconds: durationSeconds ?? null })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (upErr) throw upErr;
    return upd.id;
  }
  const { data: ins, error: insErr } = await sb.from('tracks')
    .insert({ release_id: releaseId, track_no: trackNo, title, duration_seconds: durationSeconds ?? null })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return ins.id;
}

async function ensureTrackArtist(trackId, artistId, role = 'feature') {
  if (dryRun) return true;
  const { error } = await sb.from('track_artists')
    .upsert({ track_id: trackId, artist_id: Number(artistId), role });
  if (error) throw error;
  return true;
}

// -------- MusicBrainz helpers --------
async function searchArtist(query) {
  const res = await mbGET('artist', { query: `artist:"${query}"`, limit: 10 });
  return (res.artists || []).sort((a, b) => (b.score || 0) - (a.score || 0));
}
async function pickArtistInteractive(query) {
  const list = await searchArtist(query);
  if (!list.length) throw new Error(`No MusicBrainz artist found for "${query}"`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nSelect the artist:');
  list.slice(0, 10).forEach((a, idx) => {
    const parts = [
      `${idx + 1}. ${a.name}`,
      a.type ? `(${a.type})` : '',
      a.country ? `— ${a.country}` : '',
      a['life-span']?.begin ? `, b.${a['life-span'].begin}` : '',
      a.disambiguation ? ` — ${a.disambiguation}` : '',
    ].filter(Boolean);
    console.log('   ' + parts.join(' '));
  });
  console.log('   0. Cancel');

  let choice = await rl.question('Enter number (default 1): ');
  rl.close();
  choice = String(choice || '').trim();
  if (choice === '' || choice === '1') return list[0];
  if (choice === '0') { console.log('Cancelled.'); process.exit(0); }
  const n = parseInt(choice, 10);
  if (!Number.isFinite(n) || n < 1 || n > list.length) throw new Error('Invalid choice.');
  return list[n - 1];
}

// studio/mixtape/compilation filter
const SECONDARY_TYPES_TO_EXCLUDE = new Set([
  'Live', 'Remix', 'DJ-mix', 'Soundtrack', 'Spokenword', 'Interview',
  'Audiobook', 'Demo', 'Other', 'EP', 'Single'
]);
function shouldKeepGroup(g) {
  // keep only Album primary-type
  if (String(g['primary-type'] || '').toLowerCase() !== 'album') return false;

  const secs = Array.isArray(g['secondary-types']) ? g['secondary-types'] : [];
  if (secs.length === 0) return true;

  const set = new Set(secs.map(String));
  if (set.has('Mixtape/Street')) return includeMixtapes;
  if (set.has('Compilation')) return includeCompilations;
  for (const s of set) if (SECONDARY_TYPES_TO_EXCLUDE.has(s)) return false;
  return false;
}

async function getAlbumGroups(artistMBID) {
  // IMPORTANT: do NOT pass invalid 'inc=secondary-types' (it causes 400s).
  // Use 'type=album' and filter by secondary-types from the normal payload.
  const rg = await mbGET('release-group', {
    artist: artistMBID,
    type: 'album',
    limit: 200,
  });
  const all = rg['release-groups'] || [];
  return all.filter(shouldKeepGroup);
}

async function chooseOfficialReleaseInGroup(rgId) {
  const rels = await mbGET('release', {
    'release-group': rgId,
    status: 'official',
    limit: 100,
  });
  const releases = rels.releases || [];
  if (!releases.length) return null;

  const us = releases.find(r => r.country === 'US');
  if (us) return us;
  const dated = releases.filter(r => r.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  return dated || releases[0];
}

// -------- main --------
async function importArtist(artistQuery) {
  console.log(`\n→ Importing: ${artistQuery}${dryRun ? ' (dry-run)' : ''}`);

  const mbChoice = await pickArtistInteractive(artistQuery);
  console.log(`   MusicBrainz: ${mbChoice.name} (${mbChoice.id})`);

  const mainArtist = await ensureArtist(mbChoice);
  console.log(`   DB artist #${mainArtist.id} (${mainArtist.slug})`);

  const groups = await getAlbumGroups(mbChoice.id);
  console.log(`   Studio album groups (filtered): ${groups.length}`);

  let imported = 0, skippedNoOfficial = 0;

  for (const g of groups) {
    const title = g.title;
    const year = (g['first-release-date'] || '').slice(0, 4) || null;

    const chosen = await chooseOfficialReleaseInGroup(g.id);
    if (!chosen) {
      console.log(`   • ${title} — no Official release found, skipping`);
      skippedNoOfficial += 1;
      continue;
    }

    console.log(`   • Importing "${title}" (${year || '—'})`);
    const relFull = await mbGET(`release/${chosen.id}`, { inc: 'recordings+artist-credits+media' });

    const releaseId = await upsertRelease(mainArtist.id, title, year);
    await ensurePrimaryReleaseArtist(releaseId, mainArtist.id);

    let trackNo = 0;
    for (const m of (relFull.media || [])) {
      for (const t of (m.tracks || [])) {
        trackNo += 1;
        const rec = t.recording || {};
        const tTitle = rec.title || t.title || `Track ${trackNo}`;
        const tSecs = msToSeconds(rec.length ?? t.length);
        const trackId = await upsertTrack(releaseId, trackNo, tTitle, tSecs);

        // link artist credits -> features
        for (const c of (rec['artist-credit'] || [])) {
          const mba = c.artist;
          if (!mba?.id) continue;
          const dbArtist = await ensureArtist(mba);
          const role = String(dbArtist.id) === String(mainArtist.id) ? 'primary' : 'feature';
          await ensureTrackArtist(trackId, Number(dbArtist.id), role);
        }
      }
    }

    imported += 1;
  }

  console.log(`\n✓ Done. Imported: ${imported}. Skipped (no official): ${skippedNoOfficial}.`);
  if (includeMixtapes || includeCompilations) {
    console.log(`   Options: includeMixtapes=${includeMixtapes}, includeCompilations=${includeCompilations}`);
  }
}

// -------- run only when called directly --------
const isCli = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isCli) {
  if (argv.includes('--help') || argv.includes('-h') || !nameArg) {
    console.log('Usage: node scripts/ingest-artist.mjs "Artist Name" [--include-mixtapes] [--include-compilations] [--dry-run]');
    process.exit(nameArg ? 0 : 1);
  }
  importArtist(nameArg).catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
}
