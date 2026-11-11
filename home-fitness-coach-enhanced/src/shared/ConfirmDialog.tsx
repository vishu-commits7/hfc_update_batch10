import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger (red) styling for destructive actions; false for a neutral blue confirm. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A single reusable in-app confirmation modal — replaces the browser's
 *  native `confirm()` dialog everywhere in the app. The native dialog is
 *  jarring (it freezes the page, looks like a system alert, and can't be
 *  styled), so every destructive/irreversible action routes through this
 *  instead for a consistent, smoother feel. */
export default function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = true, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-5" onClick={onCancel}>
      <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${danger ? "bg-rose-50 text-rose-500" : "bg-blue-50 text-blue-600"}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="mt-3 text-sm font-black text-slate-900">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{message}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-black text-slate-600">{cancelLabel}</button>
          <button onClick={onConfirm} className={`flex-1 rounded-xl py-2.5 text-xs font-black text-white ${danger ? "bg-rose-500" : "bg-blue-600"}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
