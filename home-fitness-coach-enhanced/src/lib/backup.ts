/**
 * Full data backup/restore — everything this app stores lives only in
 * this device's localStorage (by design, for privacy), which means a
 * lost phone, a reinstall, or clearing app storage wipes it all with no
 * way back. This lets a user export a single JSON file with everything
 * and restore it later — same device, a new one, or after a reinstall.
 */

export const BACKUP_KEYS = [
  "kinetic_profile",
  "kinetic_workouts",
  "kinetic_logs",
  "kinetic_progress_tracker_logs",
  "kinetic_favorites",
  "kinetic_water_intake",
  "kinetic_body_measurements",
  "kinetic_gallery_entries",
  "kinetic_app_theme",
  "kinetic_subscription_mode",
  "kinetic_premium_preferences",
  "kinetic_personalize_status",
  "kinetic_onboarding_seen",
  "kinetic_notification_prefs",
  "kinetic_fresh_build_version",
  "kinetic_lofi_enabled",
  "kinetic_lofi_mood",
  "kinetic_lofi_volume",
  "kinetic_sound_muted",
  "kinetic_demo_gender",
  "kinetic_demo_race",
];

interface BackupPayload {
  app: "Home Fitness Coach";
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

export function exportBackupBlob(): Blob {
  const data: Record<string, string> = {};
  BACKUP_KEYS.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  });
  const payload: BackupPayload = {
    app: "Home Fitness Coach",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

export function downloadBackup() {
  const blob = exportBackupBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `home-fitness-coach-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareBackup(): Promise<boolean> {
  const blob = exportBackupBlob();
  const file = new File([blob], `home-fitness-coach-backup-${new Date().toISOString().split("T")[0]}.json`, { type: "application/json" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Home Fitness Coach backup" });
      return true;
    }
  } catch {
    // user cancelled the share sheet — not an error
    return true;
  }
  return false;
}

export async function importBackupFile(file: File): Promise<{ ok: boolean; error?: string; restoredKeys?: number }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || parsed.app !== "Home Fitness Coach" || !parsed.data) {
      return { ok: false, error: "That doesn't look like a Home Fitness Coach backup file." };
    }
    let restored = 0;
    Object.entries(parsed.data as Record<string, string>).forEach(([key, value]) => {
      if (BACKUP_KEYS.includes(key) && typeof value === "string") {
        localStorage.setItem(key, value);
        restored++;
      }
    });
    return { ok: true, restoredKeys: restored };
  } catch {
    return { ok: false, error: "Could not read that file — make sure it's a valid backup .json." };
  }
}
