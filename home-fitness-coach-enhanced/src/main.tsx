import { seedDemoStorage } from './lib/demo';
seedDemoStorage(); // screenshot builds only; does nothing in a normal build
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { initAnalytics, trackReturnDays } from './lib/track';
import { installErrorLogging } from './lib/errorLog';

initAnalytics();
trackReturnDays();
installErrorLogging();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
);
