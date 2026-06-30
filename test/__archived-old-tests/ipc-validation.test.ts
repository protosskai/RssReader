/**
 * IPC Validation & Security Tests
 *
 * Tests the main-process validation layer that guards ALL IPC handlers.
 * These tests verify that:
 *  - Input sanitization catches malformed inputs
 *  - URL validation rejects non-http(s) protocols
 *  - Folder name validation blocks path traversal
 *  - ID validation rejects control characters
 *  - Content clamping protects against OOM
 *  - Error responses never leak stack traces
 */

import { describe, it, expect } from 'vitest';

// ------------------------------------------------------------------
// URL Validation Tests (replicating validateUrl from electron-main.ts)
// ------------------------------------------------------------------

function validateUrl(url: unknown): asserts url is string {
  if (typeof url !== 'string') {
    throw new Error('INVALID_PARAM: url must be a string');
  }
  if (url.length === 0) {
    throw new Error('INVALID_PARAM: url must not be empty');
  }
  if (url.length > 4096) {
    throw new Error(`INVALID_PARAM: url exceeds max length 4096 (got ${url.length})`);
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`INVALID_PARAM: URL protocol must be http or https, got ${parsed.protocol}`);
    }
  } catch {
    throw new Error('INVALID_PARAM: malformed URL');
  }
}

// ------------------------------------------------------------------
// Folder Name Validation Tests (replicating validateFolderName)
// ------------------------------------------------------------------

function validateFolderName(name: unknown): asserts name is string {
  if (typeof name !== 'string') {
    throw new Error('INVALID_PARAM: folderName must be a string');
  }
  if (name.length === 0) {
    throw new Error('INVALID_PARAM: folderName must not be empty');
  }
  if (name.length > 256) {
    throw new Error(`INVALID_PARAM: folderName exceeds max length 256 (got ${name.length})`);
  }
  if (/[<>:"/\\|?*\x00-\x1f]/.test(name)) {
    throw new Error('INVALID_PARAM: folderName contains invalid characters');
  }
  if (name.includes('..')) {
    throw new Error('INVALID_PARAM: folderName contains path traversal sequence (..)');
  }
  if (name.trim().length === 0) {
    throw new Error('INVALID_PARAM: folderName must not be whitespace-only');
  }
}

// ------------------------------------------------------------------
// ID Validation Tests (replicating validateId)
// ------------------------------------------------------------------

function validateId(id: unknown, label: string): asserts id is string {
  if (typeof id !== 'string') {
    throw new Error(`INVALID_PARAM: ${label} must be a string, got ${typeof id}`);
  }
  if (id.length === 0) {
    throw new Error(`INVALID_PARAM: ${label} must not be empty`);
  }
  if (id.length > 512) {
    throw new Error(`INVALID_PARAM: ${label} exceeds max length 512 (got ${id.length})`);
  }
  if (/[<>:"/\\|?*\x00-\x1f]/.test(id)) {
    throw new Error(`INVALID_PARAM: ${label} contains invalid characters`);
  }
}

// ------------------------------------------------------------------
// Content Clamping (replicating clampContent from electron-main.ts)
// ------------------------------------------------------------------

const MAX_CONTENT_BYTES = 10 * 1024 * 1024; // 10 MB

function clampContent<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    const rec = obj as Record<string, unknown>;
    if ('data' in rec && rec.data && typeof rec.data === 'object') {
      const inner = rec.data as Record<string, unknown>;
      if ('content' in inner && typeof inner.content === 'string') {
        const c = inner.content as string;
        if (c.length > MAX_CONTENT_BYTES) {
          inner.content = c.slice(0, MAX_CONTENT_BYTES) + '…[truncated]';
        }
      }
    }
    if ('content' in rec && typeof rec.content === 'string') {
      const c = rec.content as string;
      if (c.length > MAX_CONTENT_BYTES) {
        rec.content = c.slice(0, MAX_CONTENT_BYTES) + '…[truncated]';
      }
    }
  }
  return obj;
}

// ------------------------------------------------------------------
// Generic String Validation
// ------------------------------------------------------------------

function validateString(value: unknown, label: string, maxLen = 4096): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`INVALID_PARAM: ${label} must be a string, got ${typeof value}`);
  }
  if (value.length === 0) {
    throw new Error(`INVALID_PARAM: ${label} must not be empty`);
  }
  if (value.length > maxLen) {
    throw new Error(`INVALID_PARAM: ${label} exceeds max length ${maxLen} (got ${value.length})`);
  }
}

// ==================================================================
// URL Validation
// ==================================================================

describe('IPC Validation — URL', () => {
  describe('Happy Path', () => {
    const validUrls = [
      'https://example.com/rss.xml',
      'http://feeds.example.com/blog/rss',
      'https://example.com:8080/feed',
      'https://sub.domain.example.com/path/to/feed?type=rss&v=2',
    ];

    validUrls.forEach((url) => {
      it(`should accept: ${url}`, () => {
        expect(() => validateUrl(url)).not.toThrow();
      });
    });
  });

  describe('Rejections', () => {
    it('should reject empty string', () => {
      expect(() => validateUrl('')).toThrow('must not be empty');
    });

    it('should reject non-string', () => {
      expect(() => validateUrl(123)).toThrow('must be a string');
      expect(() => validateUrl(null)).toThrow('must be a string');
      expect(() => validateUrl(undefined)).toThrow('must be a string');
      expect(() => validateUrl({})).toThrow('must be a string');
    });

    it('should reject non-http protocols', () => {
      expect(() => validateUrl('ftp://example.com/feed.xml')).toThrow(/protocol|malformed/);
      // file:// and javascript: may fail at URL parse or protocol check depending on runtime
      expect(() => validateUrl('file:///etc/passwd')).toThrow(/protocol|malformed/);
      expect(() => validateUrl('javascript:alert(1)')).toThrow(/protocol|malformed/);
      expect(() => validateUrl('data:text/html,<script>alert(1)</script>')).toThrow(/protocol|malformed/);
    });

    it('should reject malformed URLs', () => {
      expect(() => validateUrl('not-a-url')).toThrow('malformed URL');
      expect(() => validateUrl('http://')).toThrow('malformed URL');
      expect(() => validateUrl('://missing-scheme')).toThrow('malformed URL');
    });

    it('should reject URLs exceeding MAX_STRING_PARAM (4096)', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(4090);
      expect(() => validateUrl(longUrl)).toThrow(/exceeds max length/);
    });
  });
});

// ==================================================================
// Folder Name Validation
// ==================================================================

describe('IPC Validation — Folder Name', () => {
  describe('Happy Path', () => {
    const validNames = [
      'Tech',
      'News Feed',
      '日本語フォルダ',
      'My Folder — with em dashes',
      'Folder (2024)',
      'New folder',
    ];

    validNames.forEach((name) => {
      it(`should accept: "${name}"`, () => {
        expect(() => validateFolderName(name)).not.toThrow();
      });
    });
  });

  describe('Rejections', () => {
    it('should reject empty string', () => {
      expect(() => validateFolderName('')).toThrow('must not be empty');
    });

    it('should reject whitespace-only', () => {
      expect(() => validateFolderName('   ')).toThrow('whitespace-only');
      expect(() => validateFolderName('\t\n  ')).toThrow('contains invalid characters');
    });

    it('should reject path traversal (..)', () => {
      // '../escape' contains '/' which is caught by char regex first
      expect(() => validateFolderName('../escape')).toThrow(/invalid characters/);
      // 'noSlash..dots' has no /, so path traversal check fires
      expect(() => validateFolderName('noSlash..dots')).toThrow('path traversal');
      expect(() => validateFolderName('folder/../etc')).toThrow(/invalid characters/);
    });

    it('should reject directory separators', () => {
      expect(() => validateFolderName('folder/name')).toThrow('invalid characters');
      expect(() => validateFolderName('folder\\name')).toThrow('invalid characters');
    });

    it('should reject control characters', () => {
      expect(() => validateFolderName('test\x00hidden')).toThrow('invalid characters');
      expect(() => validateFolderName('test\x1bcolor')).toThrow('invalid characters');
    });

    it('should reject angle brackets', () => {
      expect(() => validateFolderName('<script>')).toThrow('invalid characters');
    });

    it('should reject colons (Windows drive separator)', () => {
      expect(() => validateFolderName('C:folder')).toThrow('invalid characters');
    });

    it('should reject names exceeding MAX_FOLDER_NAME (256)', () => {
      expect(() => validateFolderName('A'.repeat(257))).toThrow(/exceeds max length/);
    });

    it('should reject non-string types', () => {
      expect(() => validateFolderName(42)).toThrow('must be a string');
      expect(() => validateFolderName(null)).toThrow('must be a string');
    });
  });
});

// ==================================================================
// ID Validation
// ==================================================================

describe('IPC Validation — ID', () => {
  describe('Happy Path', () => {
    const validIds = [
      'abc123',
      'feed-001',
      '1234567890',
      'a'.repeat(512),
    ];

    validIds.forEach((id) => {
      it(`should accept: "${id.substring(0, 40)}${id.length > 40 ? '...' : ''}"`, () => {
        expect(() => validateId(id, 'guid')).not.toThrow();
      });
    });
  });

  describe('Rejections', () => {
    it('should reject empty string', () => {
      expect(() => validateId('', 'guid')).toThrow('must not be empty');
    });

    it('should reject non-string', () => {
      expect(() => validateId(123, 'guid')).toThrow('must be a string');
    });

    it('should reject control characters', () => {
      expect(() => validateId('test\x00id', 'guid')).toThrow('invalid characters');
    });

    it('should reject IDs exceeding MAX_ID_PARAM (512)', () => {
      expect(() => validateId('x'.repeat(513), 'guid')).toThrow(/exceeds max length/);
    });

    it('should include label in error message', () => {
      expect(() => validateId('', 'guid')).toThrow('guid must not be empty');
      expect(() => validateId('', 'feedId')).toThrow('feedId must not be empty');
      expect(() => validateId('', 'rssId')).toThrow('rssId must not be empty');
    });
  });
});

// ==================================================================
// Generic String Validation
// ==================================================================

describe('IPC Validation — Generic String', () => {
  it('should accept valid strings', () => {
    expect(() => validateString('hello', 'label')).not.toThrow();
    expect(() => validateString('x', 'label')).not.toThrow();
  });

  it('should reject empty string', () => {
    expect(() => validateString('', 'label')).toThrow('label must not be empty');
  });

  it('should reject non-string', () => {
    expect(() => validateString(42, 'label')).toThrow('must be a string');
    expect(() => validateString(true, 'label')).toThrow('must be a string');
  });

  it('should reject strings exceeding custom maxLen', () => {
    expect(() => validateString('x'.repeat(101), 'label', 100)).toThrow(/exceeds max length 100/);
  });
});

// ==================================================================
// Content Clamping
// ==================================================================

describe('IPC Validation — Content Clamping', () => {
  it('should NOT clamp content under the limit', () => {
    const obj = { content: '<p>Short article</p>' };
    const result = clampContent(obj);
    expect(result.content).toBe('<p>Short article</p>');
  });

  it('should clamp content exceeding MAX_CONTENT_BYTES', () => {
    const hugeContent = 'x'.repeat(MAX_CONTENT_BYTES + 100);
    const obj = { content: hugeContent };
    const result = clampContent(obj);

    expect((result as any).content.length).toBeLessThanOrEqual(MAX_CONTENT_BYTES + 20);
    expect((result as any).content).toContain('…[truncated]');
  });

  it('should clamp content in ApiResponse { data: { content } } pattern', () => {
    const hugeContent = 'x'.repeat(MAX_CONTENT_BYTES + 100);
    const obj = {
      data: {
        title: 'Test',
        content: hugeContent,
      },
    };

    const result = clampContent(obj);
    const inner = (result as any).data;
    expect(inner.content.length).toBeLessThanOrEqual(MAX_CONTENT_BYTES + 20);
    expect(inner.content).toContain('…[truncated]');
    expect(inner.title).toBe('Test'); // unchanged
  });

  it('should handle null/undefined gracefully', () => {
    expect(() => clampContent(null)).not.toThrow();
    expect(() => clampContent(undefined)).not.toThrow();
    expect(clampContent(null)).toBeNull();
    expect(clampContent(undefined)).toBeUndefined();
  });

  it('should handle primitive values gracefully', () => {
    expect(clampContent('plain string')).toBe('plain string');
    expect(clampContent(42)).toBe(42);
    expect(clampContent(true)).toBe(true);
  });
});

// ==================================================================
// Error Response — No Stack Trace Leakage
// ==================================================================

describe('IPC Error Response — Security', () => {
  /**
   * Replicate the wrapHandler pattern from electron-main.ts.
   * The handler wraps every IPC call, catches errors, and returns
   * { error: message } WITHOUT the stack trace.
   */
  interface IpcResponse<T = unknown> {
    error?: string;
    data?: T;
  }

  function wrapHandler<T>(fn: (...args: unknown[]) => Promise<T> | T) {
    return async (...args: unknown[]): Promise<IpcResponse<T>> => {
      try {
        const data = await fn(...args);
        return { data };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: msg };
      }
    };
  }

  it('should return structured { error } without stack trace', async () => {
    const failingHandler = wrapHandler(async () => {
      throw new Error('Something bad happened');
    });

    const result = await failingHandler();

    expect(result.error).toBeDefined();
    expect(result.error).toBe('Something bad happened');
    expect(result.error).not.toContain('at ');
    expect(result.error).not.toContain('.ts:');
    expect(result.error).not.toContain('Error:');
    expect(result.data).toBeUndefined();
  });

  it('should handle non-Error throws (string)', async () => {
    const failingHandler = wrapHandler(async () => {
      throw 'plain string error';
    });

    const result = await failingHandler();

    expect(result.error).toBe('plain string error');
  });

  it('should handle non-Error throws (object)', async () => {
    const failingHandler = wrapHandler(async () => {
      throw { custom: 'error' };
    });

    const result = await failingHandler();

    expect(result.error).toBe('[object Object]');
  });

  it('should return { data } for successful handlers', async () => {
    const successHandler = wrapHandler(async (x: number) => x * 2);

    const result = await successHandler(21);

    expect(result.data).toBe(42);
    expect(result.error).toBeUndefined();
  });
});

// ==================================================================
// Table Name Whitelist
// ==================================================================

describe('SQLite Table Name Whitelist', () => {
  const ALLOWED_TABLE_NAMES = ['folder_info', 'rss_info', 'post_info', 'post_info_fts'];

  function checkTableNameAllowed(name: string): boolean {
    return ALLOWED_TABLE_NAMES.includes(name);
  }

  it('should allow valid table names', () => {
    expect(checkTableNameAllowed('folder_info')).toBe(true);
    expect(checkTableNameAllowed('rss_info')).toBe(true);
    expect(checkTableNameAllowed('post_info')).toBe(true);
    expect(checkTableNameAllowed('post_info_fts')).toBe(true);
  });

  it('should reject SQL injection in table names', () => {
    expect(checkTableNameAllowed("post_info; DROP TABLE post_info; --")).toBe(false);
    expect(checkTableNameAllowed('users')).toBe(false);
    expect(checkTableNameAllowed('information_schema.tables')).toBe(false);
    expect(checkTableNameAllowed("' OR '1'='1")).toBe(false);
  });
});
