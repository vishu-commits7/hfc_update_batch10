import type { ReactNode } from "react";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useOnline } from "../../lib/useOnline";

/** Thin bar shown at the top while the phone is offline. Chat messages queue and send when back online. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[500] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-bold text-black" style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}>
      <WifiOff className="h-3.5 w-3.5" /> You're offline. Workouts still work; social features resume when you're back.
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-carbon p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-graphite text-ink-3">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-[18rem] text-xs text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-line bg-carbon p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400"><AlertTriangle className="h-6 w-6" /></div>
      <p className="mt-3 text-sm font-semibold text-ink">Something went wrong</p>
      <p className="mx-auto mt-1 max-w-[18rem] text-xs text-ink-3">{message || "We couldn't load this. Check your connection and try again."}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-volt px-5 text-sm font-bold text-void active:scale-95">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-carbon p-3">
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-graphite" />
          <span className="flex-1 space-y-2"><span className="block h-3 w-1/2 animate-pulse rounded bg-graphite" /><span className="block h-2.5 w-1/3 animate-pulse rounded bg-graphite" /></span>
          <span className="h-4 w-10 animate-pulse rounded bg-graphite" />
        </li>
      ))}
    </ul>
  );
}
