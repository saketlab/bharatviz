import { useState, useEffect, useLayoutEffect } from 'react';

const STORAGE_KEY = 'bharatviz-dark-mode';

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getUrlOverride(): boolean | null {
  const param = new URLSearchParams(window.location.search).get('darkMode');
  if (param === 'true') return true;
  if (param === 'false') return false;
  return null;
}

function getStoredPreference(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch { /* ignore */ }
  return null;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const urlOverride = getUrlOverride();
    if (urlOverride !== null) {
      applyDark(urlOverride);
      return urlOverride;
    }
    const stored = getStoredPreference();
    const value = stored !== null ? stored : getSystemDark();
    applyDark(value);
    return value;
  });

  // Apply class synchronously before paint on every change
  useLayoutEffect(() => {
    applyDark(dark);
  }, [dark]);

  const toggle = () => setDark(d => {
    const next = !d;
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
    return next;
  });

  // Follow system preference changes only if user has never manually toggled
  useEffect(() => {
    if (getUrlOverride() !== null) return;
    if (getStoredPreference() !== null) return; // user has a manual preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return { dark, toggle, setDark };
}
