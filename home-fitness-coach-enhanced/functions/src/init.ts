/** Must be imported FIRST by every module: initialises the Admin SDK and global function options. */
import { initializeApp, getApps } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

if (!getApps().length) initializeApp();
export const REGION = process.env.FN_REGION || "asia-south1";
// Set ENFORCE_APPCHECK=true in functions/.env once the app sends App Check tokens.
export const ENFORCE_APPCHECK = process.env.ENFORCE_APPCHECK === "true";
setGlobalOptions({ region: REGION, maxInstances: 10, enforceAppCheck: ENFORCE_APPCHECK });
