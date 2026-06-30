/**
 * Electron module mock — prevents vitest from trying to load the real
 * `electron` package in a browser (happy-dom) environment.
 *
 * Also provides mocked IPC stubs for main-process API testing.
 */

import { vi } from 'vitest';

export const ipcMain = {
  handle: vi.fn(),
  handleOnce: vi.fn(),
  removeHandler: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

export const ipcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  send: vi.fn(),
  sendSync: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  postMessage: vi.fn(),
};

export const BrowserWindow = vi.fn().mockImplementation(() => ({
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  webContents: {
    openDevTools: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    session: {
      webRequest: {
        onHeadersReceived: vi.fn(),
      },
    },
  },
  on: vi.fn(),
  close: vi.fn(),
  minimize: vi.fn(),
  maximize: vi.fn(),
  restore: vi.fn(),
  isDestroyed: vi.fn(() => false),
  getId: vi.fn(() => 1),
}));

BrowserWindow.getFocusedWindow = vi.fn(() => BrowserWindow());
BrowserWindow.getAllWindows = vi.fn(() => [BrowserWindow()]);

export const app = {
  whenReady: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
  quit: vi.fn(),
  getPath: vi.fn((name: string) => `/mock/${name}`),
  getName: vi.fn(() => 'Quasar App'),
  getVersion: vi.fn(() => '0.0.1'),
  isPackaged: false,
};

export const shell = {
  openExternal: vi.fn(() => Promise.resolve()),
  openPath: vi.fn(() => Promise.resolve('')),
  showItemInFolder: vi.fn(),
};

export const dialog = {
  showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: [] })),
  showSaveDialog: vi.fn(() => Promise.resolve({ canceled: false, filePath: '' })),
  showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
};

export const nativeTheme = {
  shouldUseDarkColors: false,
  shouldUseHighContrastColors: false,
  shouldUseInvertedColorScheme: false,
  themeSource: 'system',
};

export const contextBridge = {
  exposeInMainWorld: vi.fn(),
};

export const session = {
  defaultSession: {
    webRequest: {
      onHeadersReceived: vi.fn(),
    },
  },
};

export const Menu = {
  buildFromTemplate: vi.fn(() => ({ popup: vi.fn() })),
  setApplicationMenu: vi.fn(),
};

export const Tray = vi.fn().mockImplementation(() => ({
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  destroy: vi.fn(),
}));

export const clipboard = {
  writeText: vi.fn(),
  readText: vi.fn(() => ''),
};

export const globalShortcut = {
  register: vi.fn(),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
};

export const screen = {
  getPrimaryDisplay: vi.fn(() => ({
    workAreaSize: { width: 1920, height: 1080 },
    size: { width: 1920, height: 1080 },
  })),
  getAllDisplays: vi.fn(() => []),
};

export const Notification = vi.fn().mockImplementation(() => ({
  show: vi.fn(),
  close: vi.fn(),
}));

export default {
  app,
  BrowserWindow,
  ipcMain,
  ipcRenderer,
  shell,
  dialog,
  nativeTheme,
  contextBridge,
  session,
  Menu,
  Tray,
  clipboard,
  globalShortcut,
  screen,
  Notification,
};
