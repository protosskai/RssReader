/**
 * Test setup — runs before every test file.
 *
 * Configures the test environment:
 *  - happy-dom or jsdom patches
 *  - Global mocks for Electron IPC, Pinia, etc.
 *  - Quasar plugin registration (if needed)
 */

import { vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { resetElectronClient } from '../src/services/electronClient';

// -------------------------------------------------------------------
// 1. Pinia auto-activation — create a fresh Pinia instance per test.
// -------------------------------------------------------------------
beforeEach(() => {
  setActivePinia(createPinia());
  // Reset the cached electronClient so each test gets a fresh IPC mock
  resetElectronClient();
});

// -------------------------------------------------------------------
// 0. Default IPC mock — prevents "undefined" errors when store
//    constructors call refresh() before test-specific mocks are set.
//    Tests can override per-test with mockResolvedValueOnce.
// -------------------------------------------------------------------

// Inline a minimal default IPC mock (avoids circular imports from factories.ts)
const defaultIpc = {
  getRssInfoListFromDb: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
};

beforeEach(() => {
  // Set a default window.electronAPI with a working getRssInfoListFromDb
  // so store constructors' void refresh() can complete without error.
  // Individual tests should call vi.stubGlobal('electronAPI', theirOwnMock)
  // to override.
  vi.stubGlobal('electronAPI', defaultIpc);
});

// -------------------------------------------------------------------
// 2. DOM polyfills (happy-dom still misses some Web APIs).
// -------------------------------------------------------------------
if (typeof window !== 'undefined') {
  // window.electronAPI will be set per-test via vi.stubGlobal
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  // IntersectionObserver stub (Quasar uses this for scroll-spy etc.)
  if (!window.IntersectionObserver) {
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        root: null,
        rootMargin: '',
        thresholds: [],
      })),
    });
  }

  // ResizeObserver stub
  if (!window.ResizeObserver) {
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      })),
    });
  }

  // localStorage mock
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      get length() {
        return Object.keys(store).length;
      },
    };
  })();
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

// -------------------------------------------------------------------
// 3. Console noise control — suppress expected test logs.
//    Enable per-test with vi.restoreAllMocks().
// -------------------------------------------------------------------
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Keep error visible: vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});
