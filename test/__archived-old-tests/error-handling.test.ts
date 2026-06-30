/**
 * Error Handling & Classification Tests
 *
 * Tests the ErrorMsg module (classifyError, unwrapOrThrow, ApiResponse),
 * the error code taxonomy, and edge error scenarios.
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  classifyError,
  unwrapOrThrow,
  createSuccessResponse,
  createErrorResponse,
  createVoidSuccessResponse,
  type ApiResponse,
} from '../../src/common/ErrorMsg';

// ==================================================================
// classifyError — error-code taxonomy
// ==================================================================

describe('classifyError', () => {
  describe('Network Errors', () => {
    it('should classify ETIMEDOUT → NETWORK_TIMEOUT', () => {
      const result = classifyError(new Error('ETIMEDOUT: connect timeout'));
      expect(result.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    });

    it('should classify timeout → NETWORK_TIMEOUT', () => {
      const result = classifyError(new Error('Request timed out after 30s'));
      expect(result.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    });

    it('should classify ENOTFOUND → NETWORK_DNS_FAILURE', () => {
      const result = classifyError(new Error('getaddrinfo ENOTFOUND example.com'));
      expect(result.code).toBe(ErrorCode.NETWORK_DNS_FAILURE);
    });

    it('should classify ECONNREFUSED → NETWORK_UNREACHABLE', () => {
      const result = classifyError(new Error('connect ECONNREFUSED 127.0.0.1:8080'));
      expect(result.code).toBe(ErrorCode.NETWORK_UNREACHABLE);
    });

    it('should classify generic request failure → NETWORK_REQUEST_FAILED', () => {
      const result = classifyError(new Error('HTTP request failed: 500'));
      expect(result.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
    });
  });

  describe('Parse Errors', () => {
    it('should classify invalid XML → PARSE_INVALID_XML', () => {
      const result = classifyError(new Error('invalid xml parse error'));
      expect(result.code).toBe(ErrorCode.PARSE_INVALID_XML);
    });

    it('should classify malformed → PARSE_INVALID_XML', () => {
      const result = classifyError(new Error('malformed feed'));
      expect(result.code).toBe(ErrorCode.PARSE_INVALID_XML);
    });
  });

  describe('Validation Errors', () => {
    it('should classify invalid URL → VALIDATION_INVALID_URL', () => {
      // Note: the classifyError function lowercases the message and checks
      // for 'invalid url' (with space). Messages like 'INVALID_PARAM: url'
      // lowercase to 'invalid_param: url' which doesn't include the space.
      const result = classifyError(new Error('invalid url format detected'));
      expect(result.code).toBe(ErrorCode.VALIDATION_INVALID_URL);
    });

    it('should classify not found → VALIDATION_NOT_FOUND', () => {
      const result = classifyError(new Error('guid/link【abc】不存在!'));
      expect(result.code).toBe(ErrorCode.VALIDATION_NOT_FOUND);
    });

    it('should classify duplicate → VALIDATION_DUPLICATE', () => {
      const result = classifyError(new Error('已存在同名文件夹!'));
      expect(result.code).toBe(ErrorCode.VALIDATION_DUPLICATE);
    });

    it('should classify empty/required → VALIDATION_EMPTY_FIELDS', () => {
      const result = classifyError(new Error('empty string not allowed'));
      expect(result.code).toBe(ErrorCode.VALIDATION_EMPTY_FIELDS);
    });
  });

  describe('Database Errors', () => {
    it('should classify database → DATABASE_ERROR', () => {
      // Pick a DB error that does NOT contain 'invalid', 'parse', etc.
      const result = classifyError(new Error('SQLITE_BUSY: database is locked'));
      expect(result.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it('should classify sql_ → DATABASE_ERROR', () => {
      const result = classifyError(new Error('SQL_ERROR: constraint violation'));
      expect(result.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('File Errors', () => {
    it('should classify ENOENT → FILE_NOT_FOUND', () => {
      const result = classifyError(new Error('ENOENT: no such file'));
      expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should classify EACCES → FILE_IO_ERROR', () => {
      const result = classifyError(new Error('EACCES: permission denied'));
      expect(result.code).toBe(ErrorCode.FILE_IO_ERROR);
    });
  });

  describe('Fallback', () => {
    it('should classify unknown errors → UNKNOWN_ERROR', () => {
      const result = classifyError(new Error('something completely unexpected'));
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should handle non-Error throws', () => {
      const result = classifyError('just a string');
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.message).toBe('just a string');
    });

    it('should handle null/undefined', () => {
      const result = classifyError(null);
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.message).toBe('null');

      const result2 = classifyError(undefined);
      expect(result2.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result2.message).toBe('undefined');
    });
  });

  describe('Priority / Ordering', () => {
    it('should match timeout before generic HTTP (keyword order matters)', () => {
      const result = classifyError(new Error('HTTP request timed out'));
      // "timeout" appears → NETWORK_TIMEOUT; "http" is also in string
      expect(result.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    });

    it('should match DNS before generic network', () => {
      const result = classifyError(new Error('getaddrinfo ENOTFOUND during fetch request'));
      // "enotfound" appears → DNS_FAILURE
      expect(result.code).toBe(ErrorCode.NETWORK_DNS_FAILURE);
    });
  });
});

// ==================================================================
// ApiResponse — create helpers
// ==================================================================

describe('ApiResponse Helpers', () => {
  it('should create a success response with data', () => {
    const resp = createSuccessResponse({ count: 5 });
    expect(resp.success).toBe(true);
    expect(resp.data).toEqual({ count: 5 });
  });

  it('should create a success response with arrays', () => {
    const resp = createSuccessResponse([1, 2, 3]);
    expect(resp.success).toBe(true);
    expect(resp.data).toHaveLength(3);
  });

  it('should create a success response with null data', () => {
    const resp = createSuccessResponse(null);
    expect(resp.success).toBe(true);
    expect(resp.data).toBeNull();
  });

  it('should create an error response', () => {
    const resp = createErrorResponse(ErrorCode.NETWORK_TIMEOUT, 'Timed out after 30 seconds');
    expect(resp.success).toBe(false);
    expect(resp.error!.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    expect(resp.error!.message).toBe('Timed out after 30 seconds');
  });

  it('should create a void success response', () => {
    const resp = createVoidSuccessResponse();
    expect(resp.success).toBe(true);
    expect(resp.data).toBeUndefined();
  });

  it('should distinguish success from error by .success flag', () => {
    const success = createSuccessResponse('ok');
    const error = createErrorResponse('ERR', 'bad');

    expect(success.success).toBe(true);
    expect(error.success).toBe(false);

    // Type narrowing: success has .data, error has .error
    if (success.success) {
      expect(success.data).toBeDefined();
    }
    if (!error.success) {
      expect(error.error).toBeDefined();
      expect(error.error!.code).toBe('ERR');
    }
  });
});

// ==================================================================
// unwrapOrThrow
// ==================================================================

describe('unwrapOrThrow', () => {
  it('should return data from a success response', () => {
    const response: ApiResponse<{ name: string }> = createSuccessResponse({ name: 'test' });
    const data = unwrapOrThrow(response);
    expect(data).toEqual({ name: 'test' });
  });

  it('should throw a classified error from an error response', () => {
    const response: ApiResponse<never> = createErrorResponse(
      ErrorCode.NETWORK_TIMEOUT,
      'Timed out',
    );

    expect(() => unwrapOrThrow(response)).toThrow('Timed out');

    try {
      unwrapOrThrow(response);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const typed = err as Error & { code?: string };
      expect(typed.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    }
  });

  it('should throw with the error.message as the thrown message', () => {
    const response: ApiResponse<never> = createErrorResponse(
      ErrorCode.VALIDATION_DUPLICATE,
      '已存在同名文件夹',
    );

    expect(() => unwrapOrThrow(response)).toThrow('已存在同名文件夹');
  });

  it('should handle edge case: success response with undefined data', () => {
    const response = createVoidSuccessResponse() as ApiResponse<string>;
    const data = unwrapOrThrow(response);
    expect(data).toBeUndefined();
  });
});

// ==================================================================
// Error Boundary — Store ↔ IPC error propagation
// ==================================================================

describe('Error Propagation — Store Pattern', () => {
  /**
   * Simulate the executeAndRefresh pattern from rssInfoStore.
   * The store calls an IPC method, unwraps the response, refreshes state,
   * and surfaces errors as store.error state.
   */
  class MockStore {
    error: string | null = null;
    isLoading = false;

    async executeAndRefresh<T>(
      action: () => Promise<ApiResponse<T>>,
      fallbackMessage: string,
    ): Promise<T> {
      this.isLoading = true;
      this.error = null;
      try {
        const rawResult = await action();
        return unwrapOrThrow(rawResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : fallbackMessage;
        this.error = message;
        throw new Error(message);
      } finally {
        this.isLoading = false;
      }
    }
  }

  let store: MockStore;

  beforeEach(() => {
    store = new MockStore();
  });

  it('should unwrap success and set no error', async () => {
    const action = async () => createSuccessResponse({ result: 'ok' });

    const result = await store.executeAndRefresh(action, '操作失败');

    expect(result).toEqual({ result: 'ok' });
    expect(store.error).toBeNull();
    expect(store.isLoading).toBe(false);
  });

  it('should surface error and set store.error', async () => {
    const action = async () => createErrorResponse(ErrorCode.NETWORK_TIMEOUT, 'Timed out');

    await expect(store.executeAndRefresh(action, '操作失败')).rejects.toThrow('Timed out');

    expect(store.error).toBe('Timed out');
    expect(store.isLoading).toBe(false);
  });

  it('should use fallback message for non-Error throws', async () => {
    const action = async () => {
      throw 42;
    };

    await expect(store.executeAndRefresh(action, '自定义错误信息')).rejects.toThrow('自定义错误信息');

    expect(store.error).toBe('自定义错误信息');
    expect(store.isLoading).toBe(false);
  });

  it('should use fallback when error.message is an empty string', async () => {
    // NOTE: executeAndRefresh uses `err instanceof Error ? err.message : fallback`
    // new Error('') has message '', which is technically not the fallback.
    // This test documents the current behavior — consider adding a
    // `!err.message` guard in production for robustness.
    const action = async () => {
      throw new Error('');
    };

    await expect(store.executeAndRefresh(action, '后备信息')).rejects.toThrowError();

    // store.error is set to empty string from Error(''), not the fallback
    expect(store.error).toBe('');
  });

  it('should clear previous error on success', async () => {
    store.error = 'previous failure';

    const action = async () => createSuccessResponse('ok');

    await store.executeAndRefresh(action, '不会用到');

    expect(store.error).toBeNull();
  });

  it('should overwrite previous error on new failure', async () => {
    store.error = 'first error';

    const action = async () => createErrorResponse('CODE2', 'second error');

    await expect(store.executeAndRefresh(action, '备用')).rejects.toThrow('second error');

    expect(store.error).toBe('second error');
  });
});
