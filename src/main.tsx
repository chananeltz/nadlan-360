import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// רישום Service Worker — מפעיל את אפשרות ההתקנה כאפליקציה בכרום.
// רק בפרודקשן, כדי שלא יפריע ל-HMR בפיתוח. ה-scope תואם לתת-הנתיב של
// GitHub Pages דרך BASE_URL (למשל "/nadlan-360/").
const meta = (import.meta as any).env || {};
if (meta.PROD && 'serviceWorker' in navigator) {
  const base = meta.BASE_URL || '/';
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
  });
}
