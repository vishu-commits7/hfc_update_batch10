/** Health Connect (Android): steps and active calories, read-only, kept on the device. */
import { useCallback, useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface HealthDay { dayKey: string; steps: number; kcal: number }
interface HealthPlugin {
  status(): Promise<{ available: boolean; needsInstall: boolean; granted: boolean }>;
  requestHealthAccess(): Promise<{ granted: boolean }>;
  getSummary(o: { days: number }): Promise<{ days: HealthDay[] }>;
}
const Health = registerPlugin<HealthPlugin>("ApexHealth");
const SUPPORTED = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const ON_KEY = "ap_health_on";

export type HealthState = "unsupported" | "unavailable" | "needs-install" | "off" | "ready";

/** Today's numbers plus the last 7 days. `connect()` shows Android's permission screen. */
export function useHealth() {
  const [state, setState] = useState<HealthState>(SUPPORTED ? "off" : "unsupported");
  const [days, setDays] = useState<HealthDay[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { days } = await Health.getSummary({ days: 7 });
      setDays(days); setState("ready"); setError(null);
    } catch (e: any) {
      if (e?.code === "PERMISSION") { try { localStorage.removeItem(ON_KEY); } catch { /* ignore */ } setState("off"); }
      else setError("Couldn't read Health Connect.");
    }
  }, []);

  useEffect(() => {
    if (!SUPPORTED) return;
    let alive = true;
    Health.status().then(s => {
      if (!alive) return;
      if (s.needsInstall) setState("needs-install");
      else if (!s.available) setState("unavailable");
      else if (s.granted) void load();
      else setState("off");
    }).catch(() => { if (alive) setState("unavailable"); });
    return () => { alive = false; };
  }, [load]);

  const connect = async () => {
    setBusy(true); setError(null);
    try {
      const r = await Health.requestHealthAccess();
      if (r.granted) { try { localStorage.setItem(ON_KEY, "1"); } catch { /* ignore */ } await load(); }
      else setError("Permission wasn't granted. You can allow steps and calories in Health Connect settings.");
    } catch (e: any) { setError(e?.message || "Couldn't open Health Connect."); } finally { setBusy(false); }
  };

  const today = days[0];
  return { state, days, today, busy, error, connect, refresh: load };
}
