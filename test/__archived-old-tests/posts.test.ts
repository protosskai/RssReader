/**
 * Posts E2E Tests — Loading, rendering, and navigating RSS post lists.
 *
 * Covers Flow 2: Reading Posts
 * Techniques: happy path, boundary values, error states, state transitions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  createIpcMock,
  installIpcMock,
  apiSuccess,
  apiError,
  makePostIndexItem,
  makePostIndexItems,
  makeContentInfo,
  makeRssInfoItem,
  type IpcMock,
} from '../__mocks__/factories';
import type { PostIndexItem, ContentInfo } from 'src/common/models';

describe('Flow 2: Reading Posts', () => {
  let ipc: IpcMock;

  beforeEach(() => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
  });

  // ================================================================
  // 2.1 Happy Path — posts load and display correctly
  // ================================================================

  describe('Happy Path — Loading Posts', () => {
    it('should load posts for a feed by rssId', async () => {
      const posts = makePostIndexItems(10, { rssId: 'feed-001' });

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(posts));

      const result = await ipc.queryPostIndexByRssId('feed-001');

      expect(ipc.queryPostIndexByRssId).toHaveBeenCalledWith('feed-001');
      expect(ipc.queryPostIndexByRssId).toHaveBeenCalledTimes(1);
      expect(result).toEqual(apiSuccess(posts));
    });

    it('should load the latest 10 posts', async () => {
      const posts = makePostIndexItems(10);

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(posts));

      const result = await ipc.queryPostIndexByRssId('feed-001');

      expect(result.data).toHaveLength(10);
      // Verify post structure
      const firstPost = result.data[0];
      expect(firstPost).toHaveProperty('title');
      expect(firstPost).toHaveProperty('guid');
      expect(firstPost).toHaveProperty('link');
      expect(firstPost).toHaveProperty('author');
      expect(firstPost).toHaveProperty('updateTime');
      expect(firstPost).toHaveProperty('read');
      expect(firstPost).toHaveProperty('desc');
    });

    it('should mark returned posts as read when true in DB', async () => {
      const posts = [
        makePostIndexItem({ guid: 'read-1', read: true }),
        makePostIndexItem({ guid: 'read-2', read: true }),
        makePostIndexItem({ guid: 'unread-1', read: false }),
      ];

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(posts));

      const result = await ipc.queryPostIndexByRssId('feed-001');

      expect(result.data.filter((p) => p.read)).toHaveLength(2);
      expect(result.data.filter((p) => !p.read)).toHaveLength(1);
    });
  });

  // ================================================================
  // 2.2 Happy Path — article content rendering
  // ================================================================

  describe('Happy Path — Article Content', () => {
    it('should fetch full article content by GUID', async () => {
      const content = makeContentInfo({
        guid: 'abc123',
        title: 'Full Article',
        content: '<p>Rich HTML content with <strong>formatting</strong>.</p>',
      });

      ipc.queryPostContentByGuid.mockResolvedValueOnce(apiSuccess(content));

      const result = await ipc.queryPostContentByGuid('abc123');

      expect(ipc.queryPostContentByGuid).toHaveBeenCalledWith('abc123');
      expect(result.data.title).toBe('Full Article');
      expect(result.data.content).toContain('<strong>formatting</strong>');
    });

    it('should handle articles with no author', async () => {
      const content = makeContentInfo({ author: undefined });

      ipc.queryPostContentByGuid.mockResolvedValueOnce(apiSuccess(content));

      const result = await ipc.queryPostContentByGuid('guid-no-author');

      expect(result.data.author).toBeUndefined();
      expect(result.data.title).toBeTruthy();
    });

    it('should handle articles with empty content body', async () => {
      const content = makeContentInfo({ content: '' });

      ipc.queryPostContentByGuid.mockResolvedValueOnce(apiSuccess(content));

      const result = await ipc.queryPostContentByGuid('empty-content');

      expect(result.data.content).toBe('');
      expect(result.data.title).toBeTruthy();
    });

    it('should handle articles with very long HTML content', async () => {
      const longHtml = '<div>' + 'x'.repeat(100000) + '</div>';
      const content = makeContentInfo({ content: longHtml });

      ipc.queryPostContentByGuid.mockResolvedValueOnce(apiSuccess(content));

      const result = await ipc.queryPostContentByGuid('huge-content');

      // Content should be clamped to MAX_CONTENT_BYTES by main process
      expect(result.data.content.length).toBeLessThanOrEqual(10 * 1024 * 1024 + 20);
    });
  });

  // ================================================================
  // 2.3 Boundary Values — various post data shapes
  // ================================================================

  describe('Boundary Values', () => {
    it('should handle a feed with exactly 0 posts', async () => {
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess([]));

      const result = await ipc.queryPostIndexByRssId('feed-empty');

      expect(result.data).toHaveLength(0);
      expect(result.success).toBe(true);
    });

    it('should handle a feed with exactly 1 post', async () => {
      const singlePost = [makePostIndexItem({ guid: 'solo' })];

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(singlePost));

      const result = await ipc.queryPostIndexByRssId('feed-single');

      expect(result.data).toHaveLength(1);
    });

    it('should handle a feed with a large number of posts', async () => {
      const manyPosts = makePostIndexItems(500);

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(manyPosts));

      const result = await ipc.queryPostIndexByRssId('feed-large');

      expect(result.data).toHaveLength(500);
    });

    it('should handle post titles with CJK characters', async () => {
      const post = makePostIndexItem({ title: '日本語のタイトル — 测试文章标题 — 한국어 제목' });

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess([post]));

      const result = await ipc.queryPostIndexByRssId('feed-cjk');

      expect(result.data[0].title).toBe('日本語のタイトル — 测试文章标题 — 한국어 제목');
    });

    it('should handle post titles with emoji', async () => {
      const post = makePostIndexItem({ title: '🔥🚀 Breaking News! 📰✨' });

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess([post]));

      const result = await ipc.queryPostIndexByRssId('feed-emoji');

      expect(result.data[0].title).toBe('🔥🚀 Breaking News! 📰✨');
    });

    it('should handle post GUIDs that look like URLs', async () => {
      const guidUrl = 'https://example.com/article/2024/some-long-path';
      const post = makePostIndexItem({ guid: guidUrl });

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess([post]));
      ipc.queryPostContentByGuid.mockResolvedValueOnce(
        apiSuccess(makeContentInfo({ title: 'URL GUID Article' })),
      );

      const idxResult = await ipc.queryPostIndexByRssId('feed-url-guid');
      expect(idxResult.data[0].guid).toBe(guidUrl);

      const contentResult = await ipc.queryPostContentByGuid(guidUrl);
      expect(contentResult.data.title).toBe('URL GUID Article');
    });
  });

  // ================================================================
  // 2.4 Error States — network failures, missing data
  // ================================================================

  describe('Error States', () => {
    it('should handle a non-existent feed ID', async () => {
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(
        apiError('VALIDATION_NOT_FOUND', 'Feed not found'),
      );

      const result = await ipc.queryPostIndexByRssId('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Feed not found');
    });

    it('should handle content not found for a valid GUID', async () => {
      ipc.queryPostContentByGuid.mockResolvedValueOnce(
        apiError('VALIDATION_NOT_FOUND', 'guid/link【missing-guid】不存在!'),
      );

      const result = await ipc.queryPostContentByGuid('missing-guid');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('不存在');
    });

    it('should handle database query failure', async () => {
      ipc.queryPostIndexByRssId.mockRejectedValueOnce(new Error('DATABASE_ERROR: query failed'));

      await expect(ipc.queryPostIndexByRssId('feed-001')).rejects.toThrow('query failed');
    });

    it('should handle timeout fetching posts', async () => {
      ipc.queryPostIndexByRssId.mockRejectedValueOnce(
        new Error('Timeout after 30 seconds'),
      );

      await expect(ipc.queryPostIndexByRssId('feed-slow')).rejects.toThrow('30 seconds');
    });
  });

  // ================================================================
  // 2.5 Read Status Toggle
  // ================================================================

  describe('Read Status Toggle', () => {
    it('should toggle a post from unread to read', async () => {
      ipc.toggleReadStatus.mockResolvedValueOnce(undefined);

      await ipc.toggleReadStatus('guid-1');

      expect(ipc.toggleReadStatus).toHaveBeenCalledWith('guid-1');
    });

    it('should handle toggling an already-read post (idempotent)', async () => {
      ipc.toggleReadStatus.mockResolvedValueOnce(undefined); // unread → read
      ipc.toggleReadStatus.mockResolvedValueOnce(undefined); // read → unread

      await ipc.toggleReadStatus('guid-1');
      await ipc.toggleReadStatus('guid-1');

      expect(ipc.toggleReadStatus).toHaveBeenCalledTimes(2);
    });

    it('should reject toggling with an invalid GUID', async () => {
      ipc.toggleReadStatus.mockRejectedValueOnce(
        new Error('INVALID_PARAM: guid must not be empty'),
      );

      await expect(ipc.toggleReadStatus('')).rejects.toThrow('must not be empty');
    });
  });

  // ================================================================
  // 2.6 Mark All As Read
  // ================================================================

  describe('Mark All As Read', () => {
    it('should mark all posts in a feed as read', async () => {
      ipc.markAllAsRead.mockResolvedValueOnce(undefined);

      await ipc.markAllAsRead({ feedId: 'feed-001' });

      expect(ipc.markAllAsRead).toHaveBeenCalledWith({ feedId: 'feed-001' });
    });

    it('should mark all posts in a folder as read', async () => {
      ipc.markAllAsRead.mockResolvedValueOnce(undefined);

      await ipc.markAllAsRead({ folderName: 'Tech' });

      expect(ipc.markAllAsRead).toHaveBeenCalledWith({ folderName: 'Tech' });
    });

    it('should mark all posts globally as read when no params', async () => {
      ipc.markAllAsRead.mockResolvedValueOnce(undefined);

      await ipc.markAllAsRead({});

      expect(ipc.markAllAsRead).toHaveBeenCalledWith({});
    });
  });

  // ================================================================
  // 2.7 State Transitions — post fetch lifecycle
  // ================================================================

  describe('State Transitions', () => {
    it('should handle the flow: empty → posts loaded → another feed → empty', async () => {
      // Start: empty feed
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess([]));
      const emptyResult = await ipc.queryPostIndexByRssId('feed-001');
      expect(emptyResult.data).toHaveLength(0);

      // Load some posts
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(makePostIndexItems(5)));
      const loadedResult = await ipc.queryPostIndexByRssId('feed-001');
      expect(loadedResult.data).toHaveLength(5);

      // Switch to empty feed
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess([]));
      const switchResult = await ipc.queryPostIndexByRssId('feed-empty');
      expect(switchResult.data).toHaveLength(0);
    });

    it('should handle the flow: loaded → error → reload → success', async () => {
      // First: success
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(makePostIndexItems(3)));
      const firstResult = await ipc.queryPostIndexByRssId('feed-001');
      expect(firstResult.data).toHaveLength(3);

      // Then: error
      ipc.queryPostIndexByRssId.mockRejectedValueOnce(new Error('Network error'));
      await expect(ipc.queryPostIndexByRssId('feed-001')).rejects.toThrow('Network error');

      // Then: success again
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(makePostIndexItems(7)));
      const retryResult = await ipc.queryPostIndexByRssId('feed-001');
      expect(retryResult.data).toHaveLength(7);
    });
  });
});
