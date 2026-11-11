import { reportError } from "../core/errorLog";
import React from "react";

interface Props {
  children: React.ReactNode;
  /** Called when the user taps "Back to home" — resets app navigation. */
  onReset?: () => void;
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so one broken screen can never turn the whole app
 * into a blank black window that only a force-quit fixes.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label || "app", error, info.componentStack);
    reportError(error, `boundary:${this.props.label || "app"}`);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "var(--void)", color: "var(--ink)" }}
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--carbon)" }}>
          <span className="text-2xl">⚡</span>
        </div>
        <div>
          <h2 className="text-lg font-bold">Something tripped up</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
            This screen hit a problem. Your workouts and progress are safe.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="min-h-[44px] rounded-xl px-5 text-sm font-bold"
            style={{ background: "var(--volt)", color: "#0a0a0c" }}
          >
            Back to home
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] rounded-xl border px-5 text-sm font-semibold"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
