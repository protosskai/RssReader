/**
 * Unit tests for IPC envelope unwrapping — the bug that caused white-screen /
 * failed data loads when secureInvoke only checked `'error' in raw`.
 */

import { describe, it, expect } from 'vitest';
import { unwrapOrThrow, createSuccessResponse, createErrorResponse, ErrorCode } from '../../src/common/ErrorMsg';

/** Mirror of fixed secureInvoke envelope logic in electron-preload.ts */
function unwrapIpcEnvelope<T>(raw: unknown): T {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    ('data' in raw || 'error' in raw) &&
    !('success' in raw)
  ) {
    const env = raw as { error?: string; data?: T };
    if (env.error) {
      throw new Error(typeof env.error === 'string' ? env.error : String(env.error));
    }
    return env.data as T;
  }
  return raw as T;
}

/** Broken pre-fix logic that only checked for `error` key */
function brokenSecureInvoke<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'error' in raw) {
    const env = raw as { error?: string; data?: T };
    if (env.error) throw new Error(env.error);
    return env.data as T;
  }
  return raw as T;
}

describe('IPC envelope unwrapping', () => {
  it('unwraps wrapHandler success { data } without error key', () => {
    const apiResponse = createSuccessResponse([{ folderName: '默认', data: [], children: [] }]);
    const fromMain = { data: apiResponse }; // wrapHandler success path

    const unwrapped = unwrapIpcEnvelope(fromMain);
    const folders = unwrapOrThrow(unwrapped);
    expect(folders).toHaveLength(1);
    expect(folders[0].folderName).toBe('默认');
  });

  it('throws when wrapHandler returns { error }', () => {
    expect(() => unwrapIpcEnvelope({ error: 'DB locked' })).toThrow('DB locked');
  });

  it('passes through void success { data: undefined }', () => {
    expect(unwrapIpcEnvelope({ data: undefined })).toBeUndefined();
  });

  it('does not double-unwrap ApiResponse (has success field)', () => {
    const api = createSuccessResponse([1, 2, 3]);
    // If someone accidentally calls unwrap on already-unwrapped ApiResponse
    expect(unwrapIpcEnvelope(api)).toEqual(api);
    expect(unwrapOrThrow(api)).toEqual([1, 2, 3]);
  });

  it('broken logic fails unwrapOrThrow (documents the original bug)', () => {
    const apiResponse = createSuccessResponse(['x']);
    const fromMain = { data: apiResponse }; // no error key
    const broken = brokenSecureInvoke(fromMain);
    // broken returns { data: ApiResponse } instead of ApiResponse
    expect(() => unwrapOrThrow(broken as never)).toThrow();
  });

  it('handles ApiErrorResponse after correct unwrap', () => {
    const err = createErrorResponse(ErrorCode.NETWORK_TIMEOUT, 'timeout');
    const fromMain = { data: err };
    const unwrapped = unwrapIpcEnvelope(fromMain);
    expect(() => unwrapOrThrow(unwrapped)).toThrow('timeout');
  });

  it('new API direct data (no ApiResponse) works after unwrap', () => {
    const stats = {
      totalArticles: 10,
      unreadCount: 3,
      favoriteCount: 1,
      feedCount: 2,
      folderCount: 1,
    };
    const fromMain = { data: stats };
    expect(unwrapIpcEnvelope(fromMain)).toEqual(stats);
  });
});
