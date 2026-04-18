import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import './index.css';

// Forward renderer errors to the main-process logger
const forward = (level: 'error' | 'warn', message: string) => {
  try { (window as any).electronAPI?.logRenderer?.(level, message); } catch (_) {}
};
window.addEventListener('error', (e) => {
  forward('error', `${e.message}${e.filename ? ` (${e.filename}:${e.lineno}:${e.colno})` : ''}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason: any = e.reason;
  const msg = reason instanceof Error ? (reason.stack || reason.message) : String(reason);
  forward('error', `unhandledRejection: ${msg}`);
});
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  forward('error', args.map(a => a instanceof Error ? (a.stack || a.message) : typeof a === 'object' ? safeJson(a) : String(a)).join(' '));
  origConsoleError(...(args as []));
};
function safeJson(x: unknown): string {
  try { return JSON.stringify(x); } catch { return String(x); }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
);
