import { DEMO, demoCall } from "./demo";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";

const REGION = (import.meta as any).env?.VITE_FUNCTIONS_REGION || "asia-south1";
const fns = getFunctions(firebaseApp, REGION);

/** Calls a server function. Throws the server's message on failure. */
export async function callFn<T = unknown>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  if (DEMO) return demoCall<T>(name, data); // screenshot builds never reach the server
  const res = await httpsCallable<Record<string, unknown>, T>(fns, name, { timeout: 15000 })(data);
  return res.data;
}
