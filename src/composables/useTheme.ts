/**
 * useTheme — 主题模式管理
 */
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import type { QVueGlobals } from 'quasar';

export type ThemeMode = 'light' | 'dark' | 'system';

export function useTheme() {
  const mode = ref<ThemeMode>('system');
  const isDark = ref(false);

  let $q: QVueGlobals | null = null;
  try { $q = useQuasar(); } catch { /* SSR / test */ }

  const detectSystem = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const apply = () => {
    if (typeof window === 'undefined') return;
    const dark = mode.value === 'system' ? detectSystem() : mode.value === 'dark';
    isDark.value = dark;
    $q?.dark?.set(dark);
    document.documentElement.classList.toggle('dark', dark);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', dark ? '#121212' : '#ffffff');
  };

  const setMode = (m: ThemeMode) => { mode.value = m; localStorage.setItem('themeMode', m); apply(); };
  const toggle = () => {
    if (mode.value === 'light') setMode('dark');
    else if (mode.value === 'dark') setMode('system');
    else setMode('light');
  };

  const init = () => {
    const saved = localStorage.getItem('themeMode') as ThemeMode | null;
    setMode(saved ?? 'system');
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (mode.value === 'system') apply();
      });
    }
  };

  return { mode, isDark, setMode, toggle, init, apply };
}
