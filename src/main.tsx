import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[SW] Registered successfully with scope:', reg.scope);
    }).catch((err) => {
      console.warn('[SW] Service worker registration failed:', err);
    });
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'STUDENTOS_NAVIGATE_TAB') {
      window.dispatchEvent(new CustomEvent('studentos-navigate-tab', { detail: { tab: event.data.tab } }));
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

