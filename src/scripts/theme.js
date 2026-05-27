// ============================================
// Toggle de tema dark ↔ light
// ============================================

const KEY = 'valuation:theme';

export function getTheme() {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export function setTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
  try { localStorage.setItem(KEY, theme); } catch (e) {}
  // Notifica módulos que dependem do tema (ex: Chart.js)
  window.dispatchEvent(new CustomEvent('theme:change', { detail: theme }));
}

export function toggleTheme() {
  setTheme(getTheme() === 'light' ? 'dark' : 'light');
}

export function initThemeButton() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  btn.addEventListener('click', toggleTheme);
}
