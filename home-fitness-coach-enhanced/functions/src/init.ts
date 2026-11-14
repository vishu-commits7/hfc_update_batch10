/** Must be imported FIRST by every module: initialises the Admin SDK and global function options. */
import { initializeApp, getApps } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

if (!getApps().length) initializeApp();
export const REGION = process.env.FN_REGION || "asia-south1";
// Set ENFORCE_APPCHECK=true in functions/.env once the app sends App Check tokens.
export const ENFORCE_APPCHECK = process.env.ENFORCE_APPCHECK === "true";
setGlobalOptions({ region: REGION, maxInstances: 10, enforceAppCheck: ENFORCE_APPCHECK });

// Arena ratings move only on camera-verified reps (repVerify.ts). Set ARENA_REQUIRE_CAMERA=false in functions/.env
// and redeploy to go back to rating every match, for example if camera counting turns out unreliable on real phones.
export const REQUIRE_CAMERA = process.env.ARENA_REQUIRE_CAMERA !== "false";
