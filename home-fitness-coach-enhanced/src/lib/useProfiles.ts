import { useEffect, useState } from "react";
import { getProfile, type SocialProfile } from "./social";

const cache = new Map<string, SocialProfile | null>();
const inflight = new Map<string, Promise<void>>();

/** Fetches (and caches) public profiles for a list of uids. */
export function useProfiles(uids: string[]): Map<string, SocialProfile | null> {
  const [, bump] = useState(0);
  const key = uids.slice().sort().join(",");

  useEffect(() => {
    let alive = true;
    uids.forEach(uid => {
      if (cache.has(uid) || inflight.has(uid)) return;
      const p = getProfile(uid)
        .then(v => { cache.set(uid, v); })
        .catch(() => { /* leave uncached so a later render retries */ })
        .finally(() => {
          inflight.delete(uid);
          if (alive) bump(n => n + 1);
        });
      inflight.set(uid, p);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return cache;
}
