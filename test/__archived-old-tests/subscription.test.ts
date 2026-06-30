/**
 * Subscription E2E Tests — Adding, removing, and validating RSS feeds.
 *
 * Covers Flow 1: Adding RSS Subscriptions
 * Techniques: happy path, boundary values, equivalence classes, error states, exception handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRssInfoStore } from '../../src/stores/rssInfoStore';
import {
  createIpcMock,
  installIpcMock,
  apiSuccess,
  apiError,
  makeRssFolderItem,
  makeRssInfoItem,
  EDGE_CASES,
  type IpcMock,
} from '../__mocks__/factories';

describe('Flow 1: Adding RSS Subscriptions', () => {
  let ipc: IpcMock;
  let store: ReturnType<typeof useRssInfoStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
    store = useRssInfoStore();
    // Let store init's fire-and-forget refresh() settle so it doesn't
    // consume mockResolvedValueOnce setups in test bodies
    await new Promise((r) => setTimeout(r, 20));
    // Clear call history after init so test assertions are clean
    vi.clearAllMocks();
  });

  // ================================================================
  // 1.1 Happy Path — valid feed URL
  // ================================================================

  describe('Happy Path', () => {
    it('should add a valid RSS feed and refresh folder list', async () => {
      const folderList = [makeRssFolderItem({ folderName: 'Tech' })];

      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(folderList));

      await store.addRssSubscription('https://example.com/rss.xml', 'My Feed', 'Tech');

      expect(ipc.addRssSubscription).toHaveBeenCalledTimes(1);
      expect(ipc.addRssSubscription).toHaveBeenCalledWith({
        feedUrl: 'https://example.com/rss.xml',
        title: 'My Feed',
        folderName: 'Tech',
      });
      // getRssInfoListFromDb called by both init refresh and executeAndRefresh
      expect(ipc.getRssInfoListFromDb).toHaveBeenCalled();
      expect(store.rssFolderList).toEqual(folderList);
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
    });

    it('should accept a feed URL with query parameters', async () => {
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));

      await store.addRssSubscription(
        'https://example.com/rss.xml?version=2.0&format=atom',
        'Query Feed',
        'News',
      );

      expect(ipc.addRssSubscription).toHaveBeenCalledWith({
        feedUrl: 'https://example.com/rss.xml?version=2.0&format=atom',
        title: 'Query Feed',
        folderName: 'News',
      });
    });

    it('should add a feed without a custom title', async () => {
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));

      await store.addRssSubscription('https://example.com/rss.xml', '', 'News');

      expect(ipc.addRssSubscription).toHaveBeenCalledWith({
        feedUrl: 'https://example.com/rss.xml',
        title: '',
        folderName: 'News',
      });
    });
  });

  // ================================================================
  // 1.2 Boundary Values — edge cases of input ranges
  // ================================================================

  describe('Boundary Values', () => {
    it('should reject an empty feed URL', async () => {
      // The main-process IPC handler validates and returns an error
      ipc.addRssSubscription.mockRejectedValueOnce(
        new Error('INVALID_PARAM: url must not be empty'),
      );

      await expect(
        store.addRssSubscription('', 'Test', 'Tech'),
      ).rejects.toThrow('url must not be empty');

      expect(ipc.addRssSubscription).toHaveBeenCalledWith({
        feedUrl: '',
        title: 'Test',
        folderName: 'Tech',
      });
      expect(store.error).toContain('url must not be empty');
    });

    it('should handle a whitespace-only feed URL', async () => {
      ipc.addRssSubscription.mockRejectedValueOnce(
        new Error('INVALID_PARAM: url must not be empty'),
      );

      await expect(
        store.addRssSubscription('   ', 'Test', 'Tech'),
      ).rejects.toThrow('url must not be empty');
    });

    it('should handle very long feed URLs', async () => {
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));

      await store.addRssSubscription(EDGE_CASES.VERY_LONG_URL, 'Long URL Feed', 'Tech');

      expect(ipc.addRssSubscription).toHaveBeenCalledWith({
        feedUrl: EDGE_CASES.VERY_LONG_URL,
        title: 'Long URL Feed',
        folderName: 'Tech',
      });
    });

    it('should handle very long feed titles', async () => {
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));

      await store.addRssSubscription(
        'https://example.com/rss.xml',
        EDGE_CASES.VERY_LONG_TITLE,
        'Tech',
      );

      expect(ipc.addRssSubscription).toHaveBeenCalledWith({
        feedUrl: 'https://example.com/rss.xml',
        title: EDGE_CASES.VERY_LONG_TITLE,
        folderName: 'Tech',
      });
    });

    it('should handle a valid feed URL at the minimum length', async () => {
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));

      // Minimum http URL is ~11 chars: http://a.co
      await store.addRssSubscription('http://a.co', 'Min URL', 'Tech');

      expect(ipc.addRssSubscription).toHaveBeenCalledWith({
        feedUrl: 'http://a.co',
        title: 'Min URL',
        folderName: 'Tech',
      });
    });
  });

  // ================================================================
  // 1.3 Equivalence Classes — valid and invalid URL groups
  // ================================================================

  describe('Equivalence Classes — Valid URLs', () => {
    const validUrls = [
      { label: 'HTTP URL', url: 'http://example.com/feed.xml' },
      { label: 'HTTPS URL', url: 'https://example.com/feed.xml' },
      { label: 'URL with path', url: 'https://example.com/blog/rss' },
      { label: 'URL with query', url: 'https://example.com/feed?type=rss' },
      { label: 'URL with port', url: 'https://example.com:8080/rss.xml' },
      { label: 'URL with subdomain', url: 'https://feeds.example.com/rss' },
    ];

    validUrls.forEach(({ label, url }) => {
      it(`should accept: ${label}`, async () => {
        ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
        ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));

        await store.addRssSubscription(url, label, 'Tech');

        expect(ipc.addRssSubscription).toHaveBeenCalledWith({
          feedUrl: url,
          title: label,
          folderName: 'Tech',
        });
      });
    });
  });

  describe('Equivalence Classes — Invalid URLs', () => {
    const invalidScenarios = [
      {
        label: 'FTP protocol',
        url: 'ftp://example.com/feed.xml',
        expectedError: /INVALID_PARAM.*protocol/i,
      },
      {
        label: 'Not a URL at all',
        url: 'not-a-url',
        expectedError: /INVALID_PARAM|malformed URL/i,
      },
      {
        label: 'File protocol',
        url: 'file:///etc/passwd',
        expectedError: /INVALID_PARAM.*protocol/i,
      },
      {
        label: 'No protocol',
        url: 'example.com/rss.xml',
        expectedError: /INVALID_PARAM|malformed URL/i,
      },
      {
        label: 'JavaScript pseudo-protocol',
        url: 'javascript:alert(1)',
        expectedError: /INVALID_PARAM.*protocol/i,
      },
    ];

    invalidScenarios.forEach(({ label, url, expectedError }) => {
      it(`should reject: ${label}`, async () => {
        ipc.addRssSubscription.mockRejectedValueOnce(
          new Error(`INVALID_PARAM: ${label}`),
        );

        await expect(
          store.addRssSubscription(url, label, 'Tech'),
        ).rejects.toThrow();

        expect(store.error).toBeTruthy();
      });
    });
  });

  // ================================================================
  // 1.4 Error States — network failures, invalid data, etc.
  // ================================================================

  describe('Error States', () => {
    it('should surface a duplicate feed error', async () => {
      const errorMsg = 'VALIDATION_DUPLICATE: feed already exists';
      ipc.addRssSubscription.mockRejectedValueOnce(new Error(errorMsg));
      // Note: executeAndRefresh re-throws so getRssInfoListFromDb is NOT called on error

      await expect(
        store.addRssSubscription('https://example.com/rss.xml', 'Dup', 'Tech'),
      ).rejects.toThrow(errorMsg);

      expect(store.error).toBe(errorMsg);
      expect(store.isLoading).toBe(false);
    });

    it('should surface a network timeout error', async () => {
      const errorMsg = 'NETWORK_TIMEOUT: Feed fetch timed out after 30s';
      ipc.addRssSubscription.mockRejectedValueOnce(new Error(errorMsg));

      await expect(
        store.addRssSubscription('https://slow.example.com/rss.xml', 'Slow', 'Tech'),
      ).rejects.toThrow(errorMsg);

      expect(store.error).toBe(errorMsg);
      expect(store.isLoading).toBe(false);
    });

    it('should surface a DNS resolution error', async () => {
      const errorMsg = 'NETWORK_DNS_FAILURE: getaddrinfo ENOTFOUND nonexistent.example.com';
      ipc.addRssSubscription.mockRejectedValueOnce(new Error(errorMsg));

      await expect(
        store.addRssSubscription('https://nonexistent.example.com/rss.xml', 'Bad DNS', 'Tech'),
      ).rejects.toThrow(errorMsg);

      expect(store.error).toBe(errorMsg);
    });

    it('should surface a malformed XML / parse error', async () => {
      const errorMsg = 'PARSE_INVALID_XML: Feed is not valid XML';
      ipc.addRssSubscription.mockRejectedValueOnce(new Error(errorMsg));

      await expect(
        store.addRssSubscription('https://invalid.example/feed.xml', 'Bad XML', 'Tech'),
      ).rejects.toThrow(errorMsg);

      expect(store.error).toBe(errorMsg);
    });

    it('should surface an unsupported feed format error', async () => {
      const errorMsg = 'PARSE_UNSUPPORTED_FORMAT: Not a valid RSS/Atom feed';
      ipc.addRssSubscription.mockRejectedValueOnce(new Error(errorMsg));

      await expect(
        store.addRssSubscription('https://example.com/json-feed', 'JSON Feed', 'Tech'),
      ).rejects.toThrow(errorMsg);

      expect(store.error).toBe(errorMsg);
    });

    it('should reset loading state even on error', async () => {
      ipc.addRssSubscription.mockRejectedValueOnce(new Error('FAIL'));

      expect(store.isLoading).toBe(false);
      await expect(
        store.addRssSubscription('https://example.com/rss.xml', 'Fail', 'Tech'),
      ).rejects.toThrow('FAIL');
      expect(store.isLoading).toBe(false);
      expect(store.error).toBe('FAIL');
    });

    it('should handle a folder-not-found error', async () => {
      const errorMsg = '文件夹不存在';
      ipc.addRssSubscription.mockRejectedValueOnce(new Error(errorMsg));

      await expect(
        store.addRssSubscription('https://example.com/rss.xml', 'Test', 'NonExistent'),
      ).rejects.toThrow(errorMsg);

      expect(store.error).toBe(errorMsg);
    });
  });

  // ================================================================
  // 1.5 State Transitions — loading, success, error states
  // ================================================================

  describe('State Transitions', () => {
    it('should set isLoading=true during addition, false after', async () => {
      ipc.addRssSubscription.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(apiSuccess(undefined)), 10)),
      );
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));

      const promise = store.addRssSubscription('https://example.com/rss.xml', 'T', 'Tech');

      // isLoading should be true while in-flight
      expect(store.isLoading).toBe(true);

      await promise;

      // isLoading should be false after completion
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should clear previous error on successful operation', async () => {
      // First, trigger an error
      ipc.addRssSubscription.mockRejectedValueOnce(new Error('previous error'));
      await expect(
        store.addRssSubscription('https://bad.example/rss.xml', 'Bad', 'Tech'),
      ).rejects.toThrow('previous error');
      expect(store.error).toBe('previous error');

      // Now succeed
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));
      await store.addRssSubscription('https://good.example/rss.xml', 'Good', 'Tech');

      expect(store.error).toBeNull();
    });

    it('should overwrite a previous error with a new error', async () => {
      ipc.addRssSubscription.mockRejectedValueOnce(new Error('first error'));
      await expect(
        store.addRssSubscription('https://bad1/rss.xml', 'B1', 'Tech'),
      ).rejects.toThrow('first error');
      expect(store.error).toBe('first error');

      ipc.addRssSubscription.mockRejectedValueOnce(new Error('second error'));
      await expect(
        store.addRssSubscription('https://bad2/rss.xml', 'B2', 'Tech'),
      ).rejects.toThrow('second error');
      expect(store.error).toBe('second error');
    });
  });

  // ================================================================
  // 1.6 Exception Handling — unexpected errors
  // ================================================================

  describe('Exception Handling', () => {
    it('should handle the addRssSubscription call throwing a non-Error object', async () => {
      ipc.addRssSubscription.mockRejectedValueOnce('plain string error');

      await expect(
        store.addRssSubscription('https://example.com/rss.xml', 'T', 'Tech'),
      ).rejects.toThrow('添加RSS订阅失败');

      expect(store.error).toBe('添加RSS订阅失败');
    });

    it('should handle the refresh call failing after a successful add', async () => {
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      // The refresh (getRssInfoListFromDb) fails
      ipc.getRssInfoListFromDb.mockRejectedValueOnce(new Error('DB read error'));

      await expect(
        store.addRssSubscription('https://example.com/rss.xml', 'T', 'Tech'),
      ).rejects.toThrow('DB read error');

      expect(store.error).toBe('DB read error');
    });

    it('should handle apiSuccess with null data', async () => {
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(null));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));

      await store.addRssSubscription('https://example.com/rss.xml', 'Null Data', 'Tech');

      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle apiError response from the main process', async () => {
      const errorResponse = apiError('VALIDATION_INVALID_URL', 'Bad URL format');
      ipc.addRssSubscription.mockRejectedValueOnce(new Error('Bad URL format'));

      await expect(
        store.addRssSubscription('htp://bad-format', 'T', 'Tech'),
      ).rejects.toThrow('Bad URL format');

      expect(store.error).toBe('Bad URL format');
    });
  });
});

// ================================================================
// Subscription Removal Tests
// ================================================================

describe('Subscription Removal', () => {
  let ipc: IpcMock;
  let store: ReturnType<typeof useRssInfoStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
    store = useRssInfoStore();
    await new Promise((r) => setTimeout(r, 20));
  });

  it('should remove a subscription successfully', async () => {
    const feedToRemove = makeRssInfoItem({
      id: 'feed-001',
      title: 'Example Feed',
      feedUrl: 'https://example.com/rss.xml',
    });
    const remainingFolder = makeRssFolderItem({
      data: [
        makeRssInfoItem({ id: 'feed-002', title: 'Another Feed', feedUrl: 'https://other.example/rss' }),
      ],
    });

    ipc.removeRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([remainingFolder]));

    await store.removeRssSubscription('Tech', feedToRemove);

    expect(ipc.removeRssSubscription).toHaveBeenCalledWith('Tech', 'https://example.com/rss.xml');
    expect(store.rssFolderList).toEqual([remainingFolder]);
    expect(store.error).toBeNull();
  });

  it('should surface an error when removal fails', async () => {
    const feedToRemove = makeRssInfoItem({ feedUrl: 'https://example.com/rss.xml' });

    ipc.removeRssSubscription.mockRejectedValueOnce(new Error('删除RSS订阅失败'));

    await expect(
      store.removeRssSubscription('Tech', feedToRemove),
    ).rejects.toThrow('删除RSS订阅失败');

    expect(store.error).toBe('删除RSS订阅失败');
  });

  it('should handle removal of the last subscription in a folder', async () => {
    const feedToRemove = makeRssInfoItem({ feedUrl: 'https://example.com/rss.xml' });

    ipc.removeRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([])); // empty after removal

    await store.removeRssSubscription('Tech', feedToRemove);

    expect(store.rssFolderList).toEqual([]);
    expect(store.error).toBeNull();
  });
});
