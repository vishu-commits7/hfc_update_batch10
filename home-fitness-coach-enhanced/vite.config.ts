import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/**
 * The API base guard.
 *
 * `VITE_API_BASE_URL` is read by src/lib/apiBase.ts and baked in AT BUILD
 * TIME. Inside the installed Android app there is no server on the device,
 * so if it is empty every `/api/...` call resolves to the WebView's own
 * index.html and the AI generator — the app's headline feature — fails
 * with a JSON parse error on every phone. The app still builds, installs
 * and launches perfectly, which is exactly why this shipped unnoticed.
 *
 * A warning in a build log gets scrolled past. This fails the build
 * instead, because an APK with a dead generator is worse than no APK.
 *
 * Building the plain web version, where a relative /api hits the Express
 * server on the same origin, is the one legitimate case for leaving it
 * unset: `ALLOW_MISSING_API_BASE=1 npm run build`.
 */
function assertApiBase(mode: string) {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.VITE_API_BASE_URL?.trim()) return;
  if (env.ALLOW_MISSING_API_BASE === '1' || process.env.ALLOW_MISSING_API_BASE === '1') {
    console.warn(
      '\n  [api-base] VITE_API_BASE_URL is empty — building anyway.\n' +
        '  AI workout generation will only work where /api is served from the same origin.\n',
    );
    return;
  }
  throw new Error(
    '\n\n  VITE_API_BASE_URL is not set.\n\n' +
      '  The installed app has no server on the device, so AI workout generation\n' +
      '  will fail on every phone with this build.\n\n' +
      '  Fix: deploy server.ts (Render / Railway / Cloud Run), then add to .env:\n' +
      '      VITE_API_BASE_URL=https://your-backend.example.com\n\n' +
      '  Building the web version on purpose? Use:\n' +
      '      ALLOW_MISSING_API_BASE=1 npm run build\n',
  );
}

export default defineConfig(({command, mode}) => {
  if (command === 'build') assertApiBase(mode);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // The app already code-splits by screen via React.lazy. Raising the
      // warning ceiling stops the two genuinely large, already-lazy chunks
      // (three.js and Recharts) from printing a scary warning on every
      // build and training everyone to ignore build output.
      chunkSizeWarningLimit: 700,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
