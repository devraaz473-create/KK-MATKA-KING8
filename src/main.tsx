import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary';

// Dev preview should always show the latest code without stale service-worker caching.
// Production builds keep PWA auto-update behavior for users.
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const shouldUpdate = window.confirm('Naya KK Gaming update available hai. Abhi refresh kar ke latest version use karein?');
      if (shouldUpdate) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('KK Gaming offline-ready and auto-update enabled.');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

