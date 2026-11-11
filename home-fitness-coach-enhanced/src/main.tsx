import { seedDemoStorage } from './core/demo';
seedDemoStorage(); // screenshot builds only; does nothing in a normal build
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './app/App.tsx';
import './index.css';
import ErrorBoundary from './app/ErrorBoundary.tsx';
import { initAnalytics, trackReturnDays } from './core/track';
import { installErrorLogging } from './core/errorLog';
import { initDeepLinks } from './core/deepLink';

initAnalytics();
trackReturnDays();
installErrorLogging();
initDeepLinks(); // invite links (crew, match room, friend code)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
);
