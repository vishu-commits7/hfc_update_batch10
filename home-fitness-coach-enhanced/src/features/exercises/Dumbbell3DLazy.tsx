import { Suspense, lazy } from "react";

const Dumbbell3D = lazy(() => import("./Dumbbell3D"));

export interface Dumbbell3DLazyProps {
  size?: number;
  accent?: string;
  className?: string;
}

/**
 * Deferred wrapper around the WebGL dumbbell.
 *
 * `Dumbbell3D` pulls in three.js — roughly 600KB before compression, the
 * single largest thing in the bundle. Its only consumers are the
 * onboarding slides and the personalise wizard, and onboarding runs on
 * *first launch*, which meant every new user waited for a 3D engine to
 * download before seeing anything at all. That is the worst possible
 * placement for the heaviest dependency in the app.
 *
 * Importing it lazily moves three.js off the critical path entirely: the
 * app paints, the slide renders with the placeholder below, and the real
 * model swaps in when it arrives. The placeholder holds the exact final
 * dimensions, so nothing reflows when it does.
 */
export default function Dumbbell3DLazy({
  size = 96,
  accent = "#00e5a0", // literal: three.js cannot parse a CSS custom property
  className = "",
}: Dumbbell3DLazyProps) {
  return (
    <Suspense
      fallback={
        <span
          aria-hidden
          className={`inline-block shrink-0 rounded-full ${className}`}
          style={{
            width: size,
            height: size,
            background:
              "radial-gradient(circle at 50% 42%, var(--line-strong), transparent 68%)",
          }}
        />
      }
    >
      <Dumbbell3D size={size} accent={accent} className={className} />
    </Suspense>
  );
}
