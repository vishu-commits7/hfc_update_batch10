import React, { useEffect, useRef, useState } from "react";
import { Camera, Trash2, X, ImageOff } from "lucide-react";

interface GalleryEntry {
  id: string;
  dateISO: string;
  note: string;
  dataUrl: string;
}

const STORAGE_KEY = "kinetic_gallery_entries";
// Photos are compressed before saving so a few months of weekly check-ins
// don't quietly fill up the device's local storage quota.
const MAX_DIMENSION = 900;
const JPEG_QUALITY = 0.72;

function loadEntries(): GalleryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: GalleryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn("Could not save gallery entry — device storage may be full.", e);
  }
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ProgressGallery() {
  const [entries, setEntries] = useState<GalleryEntry[]>(() => loadEntries());
  const [preview, setPreview] = useState<GalleryEntry | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ dataUrl: string } | null>(null);
  const [note, setNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => saveEntries(entries), [entries]);

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again later
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPendingUpload({ dataUrl });
      setNote("");
    } catch (err) {
      console.warn("Could not process the selected photo", err);
    }
  };

  const confirmUpload = () => {
    if (!pendingUpload) return;
    const entry: GalleryEntry = {
      id: `${Date.now()}`,
      dateISO: new Date().toISOString(),
      note: note.trim(),
      dataUrl: pendingUpload.dataUrl,
    };
    setEntries(prev => [entry, ...prev]);
    setPendingUpload(null);
    setNote("");
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    setPreview(null);
  };

  const sorted = [...entries].sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-black">Progress Gallery</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            A private, dated timeline of your own body-change photos. These stay on this device only — nothing is uploaded anywhere.
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-800 active:scale-95"
          id="btn-gallery-add-photo"
        >
          <Camera className="h-4 w-4" /> Add Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChosen}
          className="hidden"
        />
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <ImageOff className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-black text-slate-600">No photos yet</p>
          <p className="mt-1 text-xs text-slate-400">Tap "Add Photo" after each check-in to start your timeline.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sorted.map(entry => (
            <button
              key={entry.id}
              onClick={() => setPreview(entry)}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-100 bg-slate-900 text-left shadow-sm"
            >
              <img src={entry.dataUrl} alt={entry.note || formatDate(entry.dateISO)} className="h-full w-full object-cover transition group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-[10px] font-black text-white">{formatDate(entry.dateISO)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Caption/confirm modal right after picking a photo */}
      {pendingUpload && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={() => setPendingUpload(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5" onClick={e => e.stopPropagation()}>
            <img src={pendingUpload.dataUrl} alt="Preview" className="mb-4 max-h-72 w-full rounded-2xl object-cover" />
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note (e.g. Week 4, feeling stronger)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setPendingUpload(null)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-black text-slate-600">Cancel</button>
              <button onClick={confirmUpload} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white">Save to Gallery</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size viewer */}
      {preview && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black/85 p-4" onClick={() => setPreview(null)}>
          <div className="relative w-full max-w-md" onClick={e => e.stopPropagation()}>
            <img src={preview.dataUrl} alt={preview.note} className="max-h-[70vh] w-full rounded-2xl object-contain" />
            <div className="mt-3 flex items-center justify-between text-white">
              <div>
                <p className="text-sm font-black">{formatDate(preview.dateISO)}</p>
                {preview.note && <p className="mt-0.5 text-xs text-white/70">{preview.note}</p>}
              </div>
              <button onClick={() => deleteEntry(preview.id)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-red-300 hover:bg-white/20">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
          <button onClick={() => setPreview(null)} className="mt-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
