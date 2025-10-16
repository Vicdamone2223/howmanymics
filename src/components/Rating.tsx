// src/components/Rating.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Numeric rating control (50–100) for artists/releases.
 * - Tables: artist_ratings, release_ratings (RLS insert/update own).
 * - Detects per-user rating column name: score | rating | value.
 * - Computes People avg/votes from the ratings rows (no parent columns needed).
 * - Reads staff score from parent only if column exists (rating_staff).
 * - Artists show Overall = 50% staff + 50% people when both (or either) exist.
 * - ✅ Typable input: we don't clamp while typing; we clamp/validate on commit.
 */

type Kind = "artist" | "release";
type ColName = "score" | "rating" | "value";
const CANDIDATE_COLS: ColName[] = ["score", "rating", "value"];

type SummaryMode = "full" | "overall-only";

export default function Rating({
  kind,
  itemId,
  className,
  summaryMode = "full",
}: {
  kind: Kind;
  itemId: number | string;
  className?: string;
  /** Controls summary chips: "full" (default) or "overall-only" (artists only) */
  summaryMode?: SummaryMode;
}) {
  const table = kind === "artist" ? "artist_ratings" : "release_ratings";
  const fkCol = kind === "artist" ? "artist_id" : "release_id";

  const [userId, setUserId] = useState<string | null>(null);
  const [col, setCol] = useState<ColName | null>(null);

  // saved numeric value (or null if none) + typable string for input
  const [mineNum, setMineNum] = useState<number | null>(null);
  const [inputStr, setInputStr] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [peopleVotes, setPeopleVotes] = useState(0);
  const [peopleAvg, setPeopleAvg] = useState<number | null>(null);
  const [staffScore, setStaffScore] = useState<number | null>(null);

  const overall50 = useMemo(() => {
    if (kind !== "artist") return null;
    if (peopleAvg == null && staffScore == null) return null;
    const a = staffScore ?? peopleAvg ?? 0;
    const b = peopleAvg ?? staffScore ?? 0;
    return Math.round(((a + b) / 2) * 10) / 10;
  }, [kind, peopleAvg, staffScore]);

  // Load user, detect column, load ratings + staff score
  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      if (!alive) return;
      setUserId(uid);

      // Detect rating column + read all rows
      let detected: ColName | null = null;
      let rows: { user_id: string; v: number }[] = [];

      for (const c of CANDIDATE_COLS) {
        const { data, error } = await supabase
          .from(table)
          .select(`user_id, ${c}`)
          .eq(fkCol, itemId);

        if (!error) {
          detected = c;
          rows = (data || []).map((r: any) => ({
            user_id: String(r.user_id),
            v: Number(r[c]),
          }));
          break;
        }
      }

      if (!alive) return;

      if (!detected) {
        setCol(null);
        setMineNum(null);
        setInputStr("");
        setPeopleVotes(0);
        setPeopleAvg(null);
      } else {
        setCol(detected);
        if (uid) {
          const mineRow = rows.find((r) => r.user_id === uid);
          const my = Number.isFinite(mineRow?.v) ? (mineRow!.v as number) : null;
          setMineNum(my);
          setInputStr(my != null ? String(my) : "");
        } else {
          setMineNum(null);
          setInputStr("");
        }
        const votes = rows.filter((r) => Number.isFinite(r.v)).length;
        const sum = rows.reduce((n, r) => (Number.isFinite(r.v) ? n + r.v : n), 0);
        const avg = votes ? Math.round((sum / votes) * 10) / 10 : null;
        setPeopleVotes(votes);
        setPeopleAvg(avg);
      }

      // Try read rating_staff from parent if it exists
      const parentTable = kind === "artist" ? "artists" : "releases";
      let staff: number | null = null;
      const { data: rs, error: rsErr } = await supabase
        .from(parentTable)
        .select("rating_staff")
        .eq("id", itemId)
        .maybeSingle();
      if (!rsErr && rs && typeof rs.rating_staff !== "undefined" && rs.rating_staff !== null) {
        const n = Number(rs.rating_staff);
        staff = Number.isFinite(n) ? n : null;
      }
      if (!alive) return;
      setStaffScore(staff);
    })();
    return () => {
      alive = false;
    };
  }, [kind, itemId, fkCol, table]);

  function clamp50100(n: number) {
    return Math.max(50, Math.min(100, Math.round(n)));
  }

  async function persist(n: number) {
    if (!userId || !col) return;
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { user_id: userId, [fkCol]: itemId, [col]: n };
      const { error } = await supabase.from(table).upsert(payload, {
        onConflict: `user_id,${fkCol}`,
      });
      if (error) throw error;

      const prevMine = mineNum;
      setMineNum(n);
      setInputStr(String(n));

      // Local aggregates
      setPeopleVotes((pv) => (prevMine == null ? pv + 1 : pv));
      setPeopleAvg((prevAvg) => {
        const hadMine = prevMine != null;
        const pv = hadMine ? peopleVotes : peopleVotes + 1;
        if (pv <= 0) return n;
        const prevTotal = (prevAvg ?? 0) * (hadMine ? peopleVotes : peopleVotes);
        const newTotal = (prevTotal - (prevMine ?? 0)) + n;
        return Math.round((newTotal / pv) * 10) / 10;
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to save rating");
    } finally {
      setSaving(false);
    }
  }

  function commit() {
    setErr(null);
    const raw = inputStr.trim();
    if (raw === "") {
      // Keep whatever was saved before
      setInputStr(mineNum != null ? String(mineNum) : "");
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setErr("Enter a number between 50 and 100.");
      return;
    }
    const clamped = clamp50100(n);
    setInputStr(String(clamped));
    void persist(clamped);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur(); // triggers onBlur -> commit
  }

  return (
    <div className={`flex items-center gap-3 ${className || ""}`}>
      {/* input */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={50}
          max={100}
          step={1}
          inputMode="numeric"
          className="w-16 px-2 py-1 rounded-md border border-zinc-700 bg-zinc-900 text-sm tabular-nums"
          placeholder="—"
          value={inputStr}
          onChange={(e) => {
            setInputStr(e.target.value); // typable
            setErr(null);
          }}
          onBlur={commit}
          onKeyDown={onKeyDown}
          disabled={!userId || saving || !col}
          title={!userId ? "Log in to rate" : "Enter 50–100 and press Enter"}
        />
        <button
          type="button"
          className="px-2 py-1 text-xs rounded-md border border-zinc-700 hover:bg-zinc-800"
          onClick={commit}
          disabled={!userId || saving || !col}
        >
          Save
        </button>
      </div>

      {/* summary */}
      <div className="text-xs opacity-85 flex items-center gap-2">
        {kind === "artist" && summaryMode === "overall-only" ? (
          // Overall only (artists)
          <span title="Overall (50% staff, 50% people)">
            ⬛ {overall50 != null ? `${overall50}/100` : "—/100"}
          </span>
        ) : (
          <>
            {/* people */}
            <span title="People average">
              🔥 {peopleAvg != null ? `${peopleAvg}/100` : "—/100"}
              {peopleVotes ? ` (${peopleVotes})` : ""}
            </span>

            {/* staff */}
            <span title="Staff score">
              🎤 {staffScore != null ? `${staffScore}/100` : "—/100"}
            </span>

            {/* overall (artists only) */}
            {kind === "artist" && (
              <span title="Overall (50% staff, 50% people)">
                ⬛ {overall50 != null ? `${overall50}/100` : "—/100"}
              </span>
            )}
          </>
        )}

        {/* errors / hint */}
        {err && <span className="text-red-400">· {err}</span>}
        {!userId && <span className="opacity-70">· Log in to rate</span>}
      </div>
    </div>
  );
}
