/** Client data layer for friends board, friend challenges and crews. Numbers are server-owned; this only reads. */
import { useEffect, useState } from "react";
import {
  addDoc, collection, doc, documentId, getDocs, limit as fsLimit, onSnapshot, orderBy, query, serverTimestamp, where,
} from "firebase/firestore";
import { db } from "./firebase";
import { callFn } from "./functions";

const toMs = (v: any) => (v?.toMillis ? v.toMillis() : typeof v === "number" ? v : 0);

/** ISO week id in IST, same as the server (e.g. 2026-W45). */
export function currentWeekId(ms = Date.now()): string {
  const d = new Date(ms + 5.5 * 3600_000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/* ---------------- friends leaderboard ---------------- */

export interface FriendRow {
  uid: string; name: string; avatarUrl: string | null; xp: number; level: number; weekXp: number; streakDays: number; rating: number; isMe: boolean;
}

/** Accepted follows in either direction + me. Fetched once per friend-set change (max 60 friends). */
export function useFriendsBoard(meUid: string, friendUids: string[]) {
  const [rows, setRows] = useState<FriendRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tryN, setTryN] = useState(0);
  const key = friendUids.join(",");
  useEffect(() => {
    let alive = true;
    setFailed(false);
    const ids = [meUid, ...friendUids.slice(0, 59)];
    const week = currentWeekId();
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    Promise.all(chunks.map(c => getDocs(query(collection(db, "users"), where(documentId(), "in", c)))))
      .then(snaps => {
        if (!alive) return;
        setRows(snaps.flatMap(s => s.docs).map(d => {
          const x = d.data() as Record<string, any>;
          return {
            uid: d.id, name: x.displayName || "Athlete", avatarUrl: x.avatarUrl ?? null,
            xp: Number(x.xp || 0), level: Number(x.level || 1),
            weekXp: x.weekId === week ? Number(x.weekXp || 0) : 0,
            streakDays: Number(x.streakDays || 0), rating: Number(x.rating || 1000), isMe: d.id === meUid,
          } as FriendRow;
        }));
      })
      .catch(() => { if (alive) { setFailed(true); setRows([]); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meUid, key, tryN]);
  return { rows, failed, retry: () => { setRows(null); setTryN(n => n + 1); } };
}

/* ---------------- challenges ---------------- */

export interface Challenge {
  id: string; creatorUid: string; opponentUid: string; days: number;
  status: "pending" | "active" | "finished" | "declined" | "cancelled";
  names: Record<string, string>; counts: Record<string, number>;
  startAt: number; endAt: number; winnerUid: string | null; createdAt: number;
}

export function useChallenges(meUid: string) {
  const [list, setList] = useState<Challenge[] | null>(null);
  useEffect(() => {
    return onSnapshot(
      query(collection(db, "challenges"), where("members", "array-contains", meUid), fsLimit(30)),
      snap => setList(snap.docs.map(d => {
        const x = d.data() as Record<string, any>;
        return {
          id: d.id, creatorUid: x.creatorUid, opponentUid: x.opponentUid, days: Number(x.days || 7), status: x.status || "pending",
          names: x.names || {}, counts: x.counts || {}, startAt: toMs(x.startAt), endAt: toMs(x.endAt),
          winnerUid: x.winnerUid ?? null, createdAt: toMs(x.createdAt),
        } as Challenge;
      }).filter(c => c.status !== "declined" && c.status !== "cancelled").sort((a, b) => b.createdAt - a.createdAt)),
      () => setList([]),
    );
  }, [meUid]);
  return list;
}
export const createChallenge = (opponentUid: string, days: number) => callFn<{ id: string }>("challengeCreate", { opponentUid, days });
export const respondChallenge = (id: string, accept: boolean) => callFn("challengeRespond", { id, accept });

/* ---------------- crews ---------------- */

export interface Crew { id: string; name: string; ownerUid: string; memberCount: number; weeklyGoal: number; weekId: string; weekWorkouts: number; inviteCode: string }
export interface CrewMember { uid: string; name: string; avatar: string | null; role: "owner" | "member"; weekId: string; weekWorkouts: number }
export interface CrewMsg { id: string; from: string; name: string; text: string; at: number }

/** The user's crew id lives on users/{uid}.crewId (server-owned). */
export function useCrewId(meUid: string) {
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [tryN, setTryN] = useState(0);
  useEffect(() => {
    setFailed(false);
    return onSnapshot(doc(db, "users", meUid), s => { setFailed(false); setId((s.data()?.crewId as string) || null); }, () => setFailed(true));
  }, [meUid, tryN]);
  return { id, failed, retry: () => { setId(undefined); setTryN(n => n + 1); } };
}

export function useCrew(crewId: string | null | undefined) {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [msgs, setMsgs] = useState<CrewMsg[]>([]);
  const [failed, setFailed] = useState(false);     // the crew itself could not be loaded
  const [sideFailed, setSideFailed] = useState(false); // members or chat could not be loaded
  const [tryN, setTryN] = useState(0);
  useEffect(() => {
    setFailed(false); setSideFailed(false);
    if (!crewId) { setCrew(null); setMembers([]); setMsgs([]); return; }
    const un = [
      onSnapshot(doc(db, "crews", crewId), s => {
        const x = s.data();
        setCrew(x ? { id: s.id, name: x.name, ownerUid: x.ownerUid, memberCount: Number(x.memberCount || 0), weeklyGoal: Number(x.weeklyGoal || 15), weekId: x.weekId || "", weekWorkouts: Number(x.weekWorkouts || 0), inviteCode: x.inviteCode || "" } : null);
      }, () => setFailed(true)),
      onSnapshot(collection(db, "crews", crewId, "members"), s => setMembers(s.docs.map(d => {
        const x = d.data();
        return { uid: d.id, name: x.name || "Athlete", avatar: x.avatar ?? null, role: x.role === "owner" ? "owner" : "member", weekId: x.weekId || "", weekWorkouts: Number(x.weekWorkouts || 0) } as CrewMember;
      })), () => setSideFailed(true)),
      onSnapshot(query(collection(db, "crews", crewId, "messages"), orderBy("at", "desc"), fsLimit(60)), s =>
        setMsgs(s.docs.map(d => { const x = d.data({ serverTimestamps: "estimate" }); return { id: d.id, from: x.from, name: x.name || "Athlete", text: x.text || "", at: toMs(x.at) } as CrewMsg; }).reverse()), () => setSideFailed(true)),
    ];
    return () => un.forEach(u => u());
  }, [crewId, tryN]);
  return { crew, members, msgs, failed, sideFailed, retry: () => setTryN(n => n + 1) };
}

export const crewCreate = (name: string) => callFn<{ id: string }>("crewCreate", { name });
export const crewJoin = (code: string) => callFn<{ id: string }>("crewJoin", { code });
export const crewLeave = () => callFn("crewLeave");
export const crewKick = (uid: string) => callFn("crewKick", { uid });
export const crewSetGoal = (goal: number) => callFn("crewSetGoal", { goal });
export async function crewSend(crewId: string, me: { uid: string; name: string }, text: string) {
  await addDoc(collection(db, "crews", crewId, "messages"), { from: me.uid, name: me.name, text: text.trim().slice(0, 500), at: serverTimestamp() });
}
