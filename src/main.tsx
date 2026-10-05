import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      errorMsg: error?.message || String(error)
    };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[StudentOS RootErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-7 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-3xl">
              🎓
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-black text-white">StudentOS Session Recovery</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                We detected an interrupted workspace state and protected your session. Click below to reload cleanly.
              </p>
            </div>
            {this.state.errorMsg && (
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-[11px] font-mono text-rose-300 break-words text-left">
                {this.state.errorMsg}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, errorMsg: '' });
                  window.location.reload();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Reload Workspace
              </button>
              <button
                onClick={() => {
                  try {
                    sessionStorage.clear();
                    localStorage.removeItem('s_os_active_tab');
                  } catch (_) {}
                  this.setState({ hasError: false, errorMsg: '' });
                  window.location.href = '/';
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
              >
                Reset Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      window.dispatchEvent(new CustomEvent('studentos-navigate-tab', { detail: { tab: event.data.tab, linkTab: event.data.linkTab || event.data.tab } }));
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);

