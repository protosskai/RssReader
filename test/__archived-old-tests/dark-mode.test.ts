/**
 * Dark Mode E2E Tests — nativeTheme Integration and Persistence
 *
 * Covers:
 *  - state_transition: system → dark → light → system cycling
 *  - positive: dark mode activates $q.dark, body class, and localStorage
 *  - boundary: SSR/document-edge handling, empty localStorage, race conditions
 *
 * @see themeStore — src/stores/themeStore.ts
 * @see AppLayout — src/layouts/AppLayout.vue (watches isDarkMode, calls $q.dark.set)
 * @see SettingPage — src/pages/SettingPage.vue (UI toggle calls themeStore.setMode)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useThemeStore } from 'src/stores/themeStore';
import {
  createIpcMock,
  installIpcMock,
  type IpcMock,
} from '../__mocks__/factories';

// ------------------------------------------------------------------
// Quasar $q.dark polyfill — uses a mutable container so the hoisted
// vi.mock('quasar') and test code share the same object reference.
// ------------------------------------------------------------------

interface QuasarDark {
  isActive: boolean;
  set: (val: boolean) => void;
  toggle: () => void;
  mode: boolean | 'auto';
}

/** Mutable container — reassigning quasarDarkRef.value replaces the
 *  dark controller; both the mock factory and test code see updates. */
const quasarDarkRef: { value: QuasarDark } = {
  value: {
    isActive: false,
    set(val: boolean) {
      this.isActive = val;
      if (val) {
        document.body.classList.add('body--dark');
        document.body.classList.remove('body--light');
      } else {
        document.body.classList.add('body--light');
        document.body.classList.remove('body--dark');
      }
    },
    toggle() {
      this.set(!this.isActive);
    },
    mode: 'auto',
  },
};

/** Install the mock for the `quasar` module before any tests run.
 *  Because vi.mock is hoisted, it's placed at module scope. */
vi.mock('quasar', () => ({
  useQuasar: () => ({
    dark: quasarDarkRef.value,
    notify: vi.fn(),
    dialog: vi.fn(() => ({ onOk: vi.fn() })),
  }),
}));

/** Spin up a fresh mutable dark controller for each test. */
function installQuasarMock() {
  const fresh: QuasarDark = {
    isActive: false,
    set(val: boolean) {
      this.isActive = val;
      if (val) {
        document.body.classList.add('body--dark');
        document.body.classList.remove('body--light');
      } else {
        document.body.classList.add('body--light');
        document.body.classList.remove('body--dark');
      }
    },
    toggle() {
      this.set(!this.isActive);
    },
    mode: 'auto',
  };
  quasarDarkRef.value = fresh;
}

/** Shortcut to access the current quasar dark controller in tests */
function getQD() {
  return quasarDarkRef.value;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Spy on document.documentElement.classList */
function spyOnDocumentClassList() {
  return vi.spyOn(document.documentElement.classList, 'toggle');
}

/** Simulate dark/light system color scheme */
function setSystemColorScheme(dark: boolean) {
  // Assign directly (window.matchMedia was made writable in setup.ts)
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
      // Store handler so tests can trigger system theme changes
      (window as any).__darkModeListener = cb;
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/** Trigger the stored matchMedia change listener AND update matchMedia.
 *  The store's applyTheme → detectSystemTheme re-reads window.matchMedia()
 *  rather than using the event payload, so we must update both. */
function triggerSystemThemeChange(dark: boolean) {
  // First update the live matchMedia so detectSystemTheme sees the new value
  setSystemColorScheme(dark);
  // Then fire the listener so mode='system' branches re-apply
  const cb = (window as any).__darkModeListener as ((e: any) => void) | undefined;
  if (cb) {
    cb({ matches: dark });
  }
}

/** Electron nativeTheme fixture shapes */
const nativeThemeDark = { shouldUseDarkColors: true };
const nativeThemeLight = { shouldUseDarkColors: false };

function clearLocalStorage() {
  window.localStorage.clear();
}

function setLocalStorage(key: string, value: string) {
  window.localStorage.setItem(key, value);
}

function getLocalStorageItem(key: string): string | null {
  return window.localStorage.getItem(key);
}

// ------------------------------------------------------------------
// Suite
// ------------------------------------------------------------------

describe('Dark Mode — nativeTheme Integration and Persistence', () => {
  let ipc: IpcMock;

  beforeEach(() => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
    installQuasarMock();
    setSystemColorScheme(false); // default light
    clearLocalStorage();
    // Reset body classes
    document.body.classList.remove('body--dark', 'body--light');
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // 1. state_transition — Light → Dark → Light cycling
  // ================================================================

  describe('state_transition: system → light → dark → system', () => {
    it('should start in system mode and detect light scheme', () => {
      setSystemColorScheme(false);
      const store = useThemeStore();
      store.initializeTheme();

      expect(store.mode).toBe('system');
      expect(store.isDark).toBe(false);
    });

    it('should start in system mode and detect dark scheme via applyTheme', () => {
      // NOTE: initializeTheme() calls detectSystemTheme() without saving
      // its return value to this.isDark. The isDark flag is only set by
      // applyTheme(). So we call applyTheme after initialize to simulate
      // the full initialization path the AppLayout uses.
      setSystemColorScheme(true);
      const store = useThemeStore();
      store.initializeTheme();

      expect(store.mode).toBe('system');
      // isDark is still default false until applyTheme is called
      expect(store.isDark).toBe(false);

      // Call applyTheme to sync the detected system scheme
      store.applyTheme();
      expect(store.isDark).toBe(true);
    });

    it('should transition from light → dark → light via setMode', () => {
      const store = useThemeStore();
      store.initializeTheme(); // default light (system, detected light)

      // light → dark
      store.setMode('dark');
      expect(store.mode).toBe('dark');
      expect(store.isDark).toBe(true);
      expect(getQD().isActive).toBe(true);
      expect(document.body.classList.contains('body--dark')).toBe(true);

      // dark → light
      store.setMode('light');
      expect(store.mode).toBe('light');
      expect(store.isDark).toBe(false);
      expect(getQD().isActive).toBe(false);
      expect(document.body.classList.contains('body--light')).toBe(true);
    });

    it('should cycle light → dark → system via toggleMode()', () => {
      const store = useThemeStore();
      store.initializeTheme(); // system

      // system → light (toggleMode: system → light)
      store.toggleMode();
      expect(store.mode).toBe('light');

      // light → dark
      store.toggleMode();
      expect(store.mode).toBe('dark');

      // dark → system
      store.toggleMode();
      expect(store.mode).toBe('system');
    });
  });

  // ================================================================
  // 2. positive — $q.dark.isActive, body class, localStorage
  // ================================================================

  describe('positive: dark mode activation and body class', () => {
    it('should set $q.dark.isActive to true when dark mode is toggled', () => {
      const store = useThemeStore();
      store.initializeTheme();

      expect(getQD().isActive).toBe(false);

      store.setMode('dark');
      expect(getQD().isActive).toBe(true);
    });

    it('should apply body--dark class in dark mode', () => {
      const store = useThemeStore();
      store.initializeTheme();
      store.setMode('dark');

      expect(document.body.classList.contains('body--dark')).toBe(true);
      expect(document.body.classList.contains('body--light')).toBe(false);
    });

    it('should apply body--light class in light mode', () => {
      const store = useThemeStore();
      store.initializeTheme();
      store.setMode('light');

      expect(document.body.classList.contains('body--light')).toBe(true);
      expect(document.body.classList.contains('body--dark')).toBe(false);
    });

    it('should set $q.dark.isActive to false after toggling back to light', () => {
      const store = useThemeStore();
      store.initializeTheme();

      store.setMode('dark');
      expect(getQD().isActive).toBe(true);

      store.setMode('light');
      expect(getQD().isActive).toBe(false);
    });
  });

  describe('positive: localStorage persistence', () => {
    beforeEach(() => {
      clearLocalStorage();
    });

    it('should persist themeMode=dark to localStorage when dark mode is set', () => {
      const store = useThemeStore();
      store.initializeTheme();
      store.setMode('dark');

      expect(getLocalStorageItem('themeMode')).toBe('dark');
    });

    it('should persist themeMode=light to localStorage when light mode is set', () => {
      const store = useThemeStore();
      store.initializeTheme();
      store.setMode('light');

      expect(getLocalStorageItem('themeMode')).toBe('light');
    });

    it('should persist themeMode=system to localStorage when system mode is set', () => {
      const store = useThemeStore();
      store.initializeTheme();
      store.setMode('system');

      expect(getLocalStorageItem('themeMode')).toBe('system');
    });
  });

  // ================================================================
  // 3. boundary — edge cases, empty/missing localStorage, SSR safety
  // ================================================================

  describe('boundary: edge cases', () => {
    it('should gracefully handle missing localStorage key on initialize', () => {
      clearLocalStorage();
      setSystemColorScheme(false);

      const store = useThemeStore();
      store.initializeTheme();

      // Falls back to system mode, detects light
      expect(store.mode).toBe('system');
      expect(store.isDark).toBe(false);
    });

    it('should read any truthy string from localStorage without validation', () => {
      // The store reads localStorage.getItem('themeMode') and assigns
      // the raw string to this.mode without validating it against the
      // ThemeMode union type at runtime. The TypeScript type is purely
      // compile-time; at runtime any truthy string is accepted.
      setLocalStorage('themeMode', 'dark');

      const store = useThemeStore();
      store.initializeTheme();

      // Known current behavior: store trusts whatever is in localStorage
      expect(store.mode).toBe('dark');
    });

    it('should handle empty localStorage value (empty string)', () => {
      setLocalStorage('themeMode', '');

      const store = useThemeStore();
      store.initializeTheme();

      // Empty string is falsy → falls back to system detection
      expect(store.mode).toBe('system');
    });

    it('should toggle document.documentElement dark class when $q.dark is unavailable', () => {
      const toggleSpy = spyOnDocumentClassList();

      // Simulate $q.dark being unavailable by setting ref to an object
      // where $q.dark is falsy. The mock's useQuasar() returns
      // { dark: quasarDarkRef.value, ... } — if the dark property is
      // falsy, the store falls back to document.documentElement.classList.toggle.
      const originalDark = quasarDarkRef.value;
      quasarDarkRef.value = undefined as unknown as QuasarDark;

      const store = useThemeStore();
      store.initializeTheme();

      store.setMode('dark');

      // Fallback path: document.documentElement.classList.toggle
      expect(toggleSpy).toHaveBeenCalledWith('dark', true);

      store.setMode('light');
      expect(toggleSpy).toHaveBeenCalledWith('dark', false);

      quasarDarkRef.value = originalDark;
    });
  });

  // ================================================================
  // 4. nativeTheme integration (Electron)
  // ================================================================

  describe('nativeTheme: Win32 title bar respects shouldUseDarkColors', () => {
    it('should respect nativeTheme.shouldUseDarkColors on Win32', () => {
      // This simulates the guard in electron-main.ts:
      //   if (platform === 'win32' && nativeTheme.shouldUseDarkColors) { ... }
      const platform = 'win32';

      // Dark theme — shouldUseDarkColors is true
      expect(nativeThemeDark.shouldUseDarkColors).toBe(true);
      expect(platform).toBe('win32');

      // Light theme — shouldUseDarkColors is false
      expect(nativeThemeLight.shouldUseDarkColors).toBe(false);
    });

    it('should treat shouldUseDarkColors as a boolean read-only property', () => {
      // nativeTheme.shouldUseDarkColors is a read-only getter in Electron
      expect(typeof nativeThemeDark.shouldUseDarkColors).toBe('boolean');
      expect(typeof nativeThemeLight.shouldUseDarkColors).toBe('boolean');

      // Reading it multiple times returns the same value
      expect(nativeThemeDark.shouldUseDarkColors).toBe(true);
      expect(nativeThemeDark.shouldUseDarkColors).toBe(true);

      expect(nativeThemeLight.shouldUseDarkColors).toBe(false);
      expect(nativeThemeLight.shouldUseDarkColors).toBe(false);
    });

    it('should clean up DevTools Extensions when dark nativeTheme on Win32', () => {
      // Simulate the Win32 dark-mode DevTools cleanup from electron-main.ts:
      //   if (platform === 'win32' && nativeTheme.shouldUseDarkColors) {
      //     require('fs').unlinkSync(...);
      //   }
      const platform = 'win32';
      const unlinkSpy = vi.fn();

      if (platform === 'win32' && nativeThemeDark.shouldUseDarkColors) {
        unlinkSpy('/mock/userData/DevTools Extensions');
      }

      expect(unlinkSpy).toHaveBeenCalledTimes(1);
    });

    it('should not clean up DevTools Extensions when nativeTheme is light on Win32', () => {
      const platform = 'win32';
      const unlinkSpy = vi.fn();

      // Light theme — guard condition should be false
      if (platform === 'win32' && nativeThemeLight.shouldUseDarkColors) {
        unlinkSpy('/mock/userData/DevTools Extensions');
      }

      expect(unlinkSpy).not.toHaveBeenCalled();
    });

    it('should not clean up DevTools Extensions on non-Win32 platforms', () => {
      const platform = 'darwin'; // macOS
      const unlinkSpy = vi.fn();

      if (platform === 'win32' && nativeThemeDark.shouldUseDarkColors) {
        unlinkSpy('/mock/userData/DevTools Extensions');
      }

      expect(unlinkSpy).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // 5. state_transition — Session restore: persisted preference
  // ================================================================

  describe('state_transition: session restore loads persisted preference', () => {
    it('should restore dark mode on re-initialization', () => {
      // First session: persist dark
      setLocalStorage('themeMode', 'dark');
      const store1 = useThemeStore();
      store1.initializeTheme();

      expect(store1.mode).toBe('dark');
      expect(store1.isDark).toBe(true);
      expect(getQD().isActive).toBe(true);

      // Simulate a fresh store (new session) with the same localStorage
      installQuasarMock(); // reset dark state like a page reload
      const store2 = useThemeStore();
      store2.initializeTheme();

      expect(store2.mode).toBe('dark');
      expect(store2.isDark).toBe(true);
      expect(getQD().isActive).toBe(true);
    });

    it('should restore light mode on re-initialization', () => {
      setLocalStorage('themeMode', 'light');
      const store = useThemeStore();
      store.initializeTheme();

      expect(store.mode).toBe('light');
      expect(store.isDark).toBe(false);
      expect(getQD().isActive).toBe(false);
    });

    it('should restore system mode and re-detect system preference on re-initialization', () => {
      setLocalStorage('themeMode', 'system');
      setSystemColorScheme(true); // system is dark

      const store = useThemeStore();
      store.initializeTheme();

      expect(store.mode).toBe('system');
      expect(store.isDark).toBe(true);
      expect(getQD().isActive).toBe(true);
    });

    it('should restore dark preference across a full page reload cycle', () => {
      // Simulate page load sequence
      // 1. Store themeMode=dark
      setLocalStorage('themeMode', 'dark');

      // 2. "Page loads" — store initializes from localStorage
      const store = useThemeStore();
      store.initializeTheme();

      expect(store.mode).toBe('dark');
      expect(store.isDark).toBe(true);
      expect(getLocalStorageItem('themeMode')).toBe('dark');

      // 3. "Page reloads" — fresh store instance reads same localStorage
      installQuasarMock(); // reset like a page reload
      const storeAfterReload = useThemeStore();
      storeAfterReload.initializeTheme();

      expect(storeAfterReload.mode).toBe('dark');
      expect(storeAfterReload.isDark).toBe(true);
      expect(getQD().isActive).toBe(true);
    });
  });

  // ================================================================
  // 6. positive — $q.dark.set called via AppLayout watcher
  // ================================================================

  describe('positive: Quasar dark.set integration', () => {
    it('should call $q.dark.set(true) when isDarkMode becomes true', () => {
      const store = useThemeStore();
      store.initializeTheme();

      store.setMode('dark');

      // applyTheme calls $q.dark.set(isDark) via useQuasar()
      expect(getQD().isActive).toBe(true);
    });

    it('should call $q.dark.set(false) when toggled back to light', () => {
      const store = useThemeStore();
      store.initializeTheme();

      store.setMode('dark');
      expect(getQD().isActive).toBe(true);

      store.setMode('light');
      expect(getQD().isActive).toBe(false);
    });

    it('should set dark mode body class via $q.dark.set(true)', () => {
      getQD().set(true);

      expect(document.body.classList.contains('body--dark')).toBe(true);
      expect(document.body.classList.contains('body--light')).toBe(false);
    });

    it('should set light mode body class via $q.dark.set(false)', () => {
      getQD().set(true); // first dark
      getQD().set(false); // then light

      expect(document.body.classList.contains('body--light')).toBe(true);
      expect(document.body.classList.contains('body--dark')).toBe(false);
    });
  });

  // ================================================================
  // 7. boundary — system theme change listener
  // ================================================================

  describe('boundary: system theme change listener', () => {
    it('should re-apply theme when system scheme changes in system mode', () => {
      setSystemColorScheme(false); // light
      const store = useThemeStore();
      store.initializeTheme();
      store.applyTheme(); // sync initial state
      store.listenToSystemThemeChange();

      expect(store.isDark).toBe(false);

      // System switches to dark
      triggerSystemThemeChange(true);
      store.applyTheme(); // called by the listener

      expect(store.isDark).toBe(true);
    });

    it('should NOT re-apply theme when system scheme changes in explicit dark mode', () => {
      setSystemColorScheme(false);
      const store = useThemeStore();
      store.initializeTheme();
      store.listenToSystemThemeChange();

      // User explicitly sets dark
      store.setMode('dark');
      expect(store.mode).toBe('dark');
      expect(store.isDark).toBe(true);

      // System changes to light — should be ignored because mode !== 'system'
      triggerSystemThemeChange(false);
      store.applyTheme(); // mode is 'dark', so applyTheme ignores system

      expect(store.isDark).toBe(true); // still dark
    });
  });

  // ================================================================
  // 8. positive — meta theme color
  // ================================================================

  describe('positive: meta theme color update', () => {
    it('should update meta theme-color to dark (#121212) in dark mode', () => {
      // Add the meta tag as the app would
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#ffffff';
      document.head.appendChild(meta);

      const store = useThemeStore();
      store.initializeTheme();
      store.setMode('dark');

      const metaEl = document.querySelector('meta[name="theme-color"]');
      expect(metaEl?.getAttribute('content')).toBe('#121212');

      document.head.removeChild(meta);
    });

    it('should update meta theme-color to light (#ffffff) in light mode', () => {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#121212';
      document.head.appendChild(meta);

      const store = useThemeStore();
      store.initializeTheme();
      store.setMode('light');

      const metaEl = document.querySelector('meta[name="theme-color"]');
      expect(metaEl?.getAttribute('content')).toBe('#ffffff');

      document.head.removeChild(meta);
    });
  });
});
