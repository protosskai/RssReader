// ============================================================
// Electron Renderer Type Declarations
// ============================================================
// Declares `window.electronAPI` — the ONLY bridge between the
// renderer (sandboxed) and the Electron main process. All IPC
// goes through the preload script's channel whitelist and the
// main process's input validation + error sanitization pipeline.
// ============================================================

import type { ElectronContract } from 'src/common/electronContract';

export type { ElectronContract };

declare global {
  interface Window {
    /**
     * Electron IPC API bridge exposed via contextBridge.
     *
     * ## Security architecture
     *
     * ### Channel whitelist (preload)
     * Only channels declared in the preload `ALLOWED_CHANNELS` set
     * can be invoked. Calling an unlisted channel throws `Error`.
     *
     * ### Input validation (main)
     * Every parameter is type-checked and sanitized before processing:
     * - **URLs** — must be `http:` or `https:` with valid syntax
     * - **Folder names** — rejected if they contain path traversal
     *   (`..`), control characters, `< > : " / \\ | ? *`
     * - **IDs** — length-capped (512 chars), free of special chars
     * - **Strings** — capped at 4096 chars (4 KB)
     *
     * ### Error sanitization (main)
     * Stack traces are **never** sent over IPC. Only the error
     * message reaches the renderer.
     *
     * ### Content size limits (main)
     * - **Article body**: clamped at 10 MB
     * - **Article lists**: capped at 500 items per page
     * - **Search results**: capped at 200 items
     * - **Keyword queries**: capped at 1024 chars
     *
     * ### Context isolation
     * `contextIsolation: true` + `nodeIntegration: false` in the
     * BrowserWindow config. The preload script is the single entry
     * point — no Node or Electron APIs leak into the renderer.
     *
     * ## Error handling in renderer
     *
     * Legacy APIs return `ApiResponse<T>` — use `unwrapOrThrow()`:
     * ```ts
     * import { unwrapOrThrow } from 'src/common/ErrorMsg';
     * const folders = unwrapOrThrow(
     *   await window.electronAPI.getRssInfoListFromDb()
     * );
     * ```
     *
     * Newer APIs throw `Error` with the sanitized message:
     * ```ts
     * try {
     *   await window.electronAPI.toggleReadStatus(id);
     * } catch (err) {
     *   console.error(err.message);
     * }
     * ```
     */
    electronAPI: ElectronContract;
  }
}

export {};
