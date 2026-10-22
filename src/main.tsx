import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Service Worker Lifecycle: actively unregister & purge caches in development to avoid stale React chunk mismatches
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if ((import.meta as any).env?.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker actif avec scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker enregistrement échoué:', error);
        });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

