/**
 * Folder CRUD E2E Tests — Create → Rename → Move Feed → Delete
 *
 * Full folder lifecycle through folderStore (v2 API).
 * Techniques: positive, equivalence_class, state_transition, exception
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFolderStore } from '../../src/stores/folderStore';
import {
  createIpcMock,
  installIpcMock,
  makeRssInfoItem,
  type IpcMock,
} from '../__mocks__/factories';
import type { Folder, FeedSource } from 'src/common/models';

// ===========================================================================
// Fixtures
// ===========================================================================

const FOLDER_FIXTURES = {
  technology: { id: 'f-1', name: 'Technology', feedCount: 0, parentId: null, order: 0 } as Folder,
  science: { id: 'f-2', name: 'Science', feedCount: 0, parentId: null, order: 1 } as Folder,
  cjk: { id: 'f-3', name: '中文科技', feedCount: 0, parentId: null, order: 2 } as Folder,
  techRenamed: { id: 'f-1', name: 'Tech', feedCount: 0, parentId: null, order: 0 } as Folder,
  techWithFeed: { id: 'f-1', name: 'Tech', feedCount: 1, parentId: null, order: 0 } as Folder,
  techFeedMoved: { id: 'f-1', name: 'Tech', feedCount: 0, parentId: null, order: 0 } as Folder,
  scienceWithFeed: { id: 'f-2', name: 'Science', feedCount: 1, parentId: null, order: 1 } as Folder,
};

const FEED_FIXTURE: FeedSource = {
  id: 'feed-go',
  title: 'Golang Weekly',
  feedUrl: 'https://golangweekly.com/rss',
  htmlUrl: 'https://golangweekly.com',
  unreadCount: 8,
  avatar: '',
  url: 'https://golangweekly.com/rss',
  folderName: 'Tech',
};

const FEED_FIXTURE_IN_SCIENCE: FeedSource = {
  ...FEED_FIXTURE,
  folderName: 'Science',
};

// ===========================================================================
// Test Suite
// ===========================================================================

describe('Folder CRUD — Create → Rename → Move Feed → Delete', () => {
  let ipc: IpcMock;
  let store: ReturnType<typeof useFolderStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
    store = useFolderStore();

    // store constructor does NOT auto-call loadFolders(), so no
    // spurious IPC calls during initialization.
    // Clear any leftover call counts from pinia / setup.
    vi.clearAllMocks();
  });

  // ================================================================
  // 1. POSITIVE PATH — Create 3 folders including CJK name
  // ================================================================

  describe('Positive Path: Create Folders', () => {
    it('should create 3 folders including one with CJK name', async () => {
      // Step 1: Create "Technology"
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([FOLDER_FIXTURES.technology]);
      await store.addFolder('Technology');

      // Step 2: Create "Science"
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([FOLDER_FIXTURES.technology, FOLDER_FIXTURES.science]);
      await store.addFolder('Science');

      // Step 3: Create "中文科技"
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        FOLDER_FIXTURES.technology,
        FOLDER_FIXTURES.science,
        FOLDER_FIXTURES.cjk,
      ]);
      await store.addFolder('中文科技');

      // Assertions
      expect(store.folders).toHaveLength(3);
      expect(store.folderNames).toContain('Technology');
      expect(store.folderNames).toContain('Science');
      expect(store.folderNames).toContain('中文科技');

      // Verify CJK name is preserved byte-for-byte
      const cjkFolder = store.getFolderByName('中文科技');
      expect(cjkFolder).not.toBeNull();
      expect(cjkFolder!.name).toBe('中文科技');

      // Verify IPC was called with the correct names
      expect(ipc.addFolderV2).toHaveBeenNthCalledWith(1, 'Technology');
      expect(ipc.addFolderV2).toHaveBeenNthCalledWith(2, 'Science');
      expect(ipc.addFolderV2).toHaveBeenNthCalledWith(3, '中文科技');
    });
  });

  // ================================================================
  // 2. POSITIVE PATH — Rename Folder
  // ================================================================

  describe('Positive Path: Rename Folder', () => {
    it('should rename "Technology" to "Tech" and update computed state', async () => {
      // --- Arrange: preload folders into store ---
      store.folders = [
        FOLDER_FIXTURES.technology,
        FOLDER_FIXTURES.science,
        FOLDER_FIXTURES.cjk,
      ];

      // --- Act: rename ---
      ipc.renameFolder.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        FOLDER_FIXTURES.techRenamed,
        FOLDER_FIXTURES.science,
        FOLDER_FIXTURES.cjk,
      ]);
      await store.renameFolder('Technology', 'Tech');

      // --- Assert ---
      expect(ipc.renameFolder).toHaveBeenCalledWith('Technology', 'Tech');
      expect(ipc.renameFolder).toHaveBeenCalledTimes(1);

      expect(store.folderNames).toContain('Tech');
      expect(store.folderNames).not.toContain('Technology');
      expect(store.folderNames).toHaveLength(3);

      // Folder object is replaced atomically
      const techFolder = store.getFolderByName('Tech');
      expect(techFolder).not.toBeNull();
      expect(techFolder!.id).toBe('f-1');
      expect(techFolder!.name).toBe('Tech');
    });
  });

  // ================================================================
  // 3. STATE TRANSITION — Add feed then move feed between folders
  // ================================================================

  describe('State Transition: Add and Move Feed Across Folders', () => {
    it('should add a feed to "Tech" then move it to "Science"', async () => {
      // --- Arrange: preload folders ---
      store.folders = [
        FOLDER_FIXTURES.techRenamed,
        FOLDER_FIXTURES.science,
        FOLDER_FIXTURES.cjk,
      ];

      // --- Phase 1: Add feed to "Tech" folder ---
      ipc.addFeed.mockResolvedValueOnce(undefined);
      ipc.getFeeds.mockResolvedValueOnce([FEED_FIXTURE]);
      await ipc.addFeed('https://golangweekly.com/rss', 'Golang Weekly', 'Tech');

      // Reload folders to pick up the updated feedCount from backend
      ipc.getFolders.mockResolvedValueOnce([
        FOLDER_FIXTURES.techWithFeed,
        FOLDER_FIXTURES.science,
        FOLDER_FIXTURES.cjk,
      ]);
      await store.loadFolders();

      // Verify feed landed in Tech
      expect(ipc.addFeed).toHaveBeenCalledWith(
        'https://golangweekly.com/rss',
        'Golang Weekly',
        'Tech',
      );
      const techFolder = store.getFolderByName('Tech');
      expect(techFolder).not.toBeNull();
      expect(techFolder!.feedCount).toBe(1);

      // --- Phase 2: Move feed from "Tech" to "Science" ---
      // Remove the feed from its original folder
      ipc.removeFeed.mockResolvedValueOnce(undefined);
      await ipc.removeFeed('feed-go');

      // Re-add it under the Science folder
      ipc.addFeed.mockResolvedValueOnce(undefined);
      ipc.getFeeds.mockResolvedValueOnce([FEED_FIXTURE_IN_SCIENCE]);
      await ipc.addFeed('https://golangweekly.com/rss', 'Golang Weekly', 'Science');

      // Reload folders — feedCount shifts from Tech→Science
      ipc.getFolders.mockResolvedValueOnce([
        FOLDER_FIXTURES.techFeedMoved,
        FOLDER_FIXTURES.scienceWithFeed,
        FOLDER_FIXTURES.cjk,
      ]);
      await store.loadFolders();

      // Verify feed moved
      const techAfterMove = store.getFolderByName('Tech');
      const scienceAfterMove = store.getFolderByName('Science');
      expect(techAfterMove!.feedCount).toBe(0);
      expect(scienceAfterMove!.feedCount).toBe(1);

      // IPC calls verification
      expect(ipc.removeFeed).toHaveBeenCalledWith('feed-go');
      expect(ipc.addFeed).toHaveBeenLastCalledWith(
        'https://golangweekly.com/rss',
        'Golang Weekly',
        'Science',
      );
    });
  });

  // ================================================================
  // 4. POSITIVE PATH — Delete folders (empty and with feed)
  // ================================================================

  describe('Positive Path: Delete Folders', () => {
    it('should delete empty "Science" then delete "Tech" (cascading feeds)', async () => {
      // --- Arrange: preload with feedCount representing one feed in Science, one in Tech ---
      store.folders = [
        { ...FOLDER_FIXTURES.techWithFeed, name: 'Tech' },
        { ...FOLDER_FIXTURES.scienceWithFeed, name: 'Science' },
        FOLDER_FIXTURES.cjk,
      ];

      // --- Phase 1: Delete empty folder "Science" ---
      ipc.removeFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        { ...FOLDER_FIXTURES.techWithFeed, name: 'Tech' },
        FOLDER_FIXTURES.cjk,
      ]);
      await store.removeFolder('Science');

      expect(ipc.removeFolderV2).toHaveBeenCalledWith('Science');
      expect(store.folders).toHaveLength(2);
      expect(store.folderNames).toEqual(['Tech', '中文科技']);
      expect(store.folderNames).not.toContain('Science');

      // --- Phase 2: Delete "Tech" which has a feed (must cascade) ---
      ipc.removeFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([FOLDER_FIXTURES.cjk]);
      await store.removeFolder('Tech');

      expect(ipc.removeFolderV2).toHaveBeenCalledWith('Tech');
      expect(store.folders).toHaveLength(1);
      expect(store.folderNames).toEqual(['中文科技']);
      expect(store.folderNames).not.toContain('Tech');
    });
  });

  // ================================================================
  // 5. EXCEPTION / ERROR PATHS
  // ================================================================

  describe('Exception Paths', () => {
    it('should throw "Folder already exists" when creating a duplicate folder', async () => {
      ipc.addFolderV2.mockRejectedValueOnce(
        new Error('Folder already exists'),
      );

      await expect(store.addFolder('Technology')).rejects.toThrow(
        'Folder already exists',
      );

      // Note: folderStore.addFolder does NOT persist the error in store.error
      // (only loadFolders/loadFolder set store.error). The error is thrown directly.
      expect(store.error).toBeNull();

      // Folder list should remain unchanged
      expect(store.folders).toHaveLength(0);
    });

    it('should throw "INVALID_PARAM" when creating a folder with empty name', async () => {
      ipc.addFolderV2.mockRejectedValueOnce(
        new Error('INVALID_PARAM: folderName must not be empty'),
      );

      await expect(store.addFolder('')).rejects.toThrow('INVALID_PARAM');

      // Note: folderStore.addFolder does NOT persist the error in store.error
      expect(store.error).toBeNull();
      expect(store.folders).toHaveLength(0);
    });

    it('should throw an error when deleting a non-existent folder', async () => {
      // Preload one folder so we have state
      store.folders = [FOLDER_FIXTURES.cjk];

      ipc.removeFolderV2.mockRejectedValueOnce(
        new Error('Folder not found: NonExistent'),
      );

      await expect(store.removeFolder('NonExistent')).rejects.toThrow(
        'Folder not found',
      );

      // Folder list should remain unchanged
      expect(store.folders).toHaveLength(1);
      expect(store.folderNames).toContain('中文科技');
    });

    it('should throw "INVALID_PARAM" when renaming to empty name', async () => {
      ipc.renameFolder.mockRejectedValueOnce(
        new Error('INVALID_PARAM: new folderName must not be empty'),
      );

      await expect(store.renameFolder('Tech', '')).rejects.toThrow(
        'INVALID_PARAM',
      );

      // Note: folderStore.renameFolder does NOT persist the error in store.error
      expect(store.error).toBeNull();
    });

    it('should throw an error when renaming to an existing folder name', async () => {
      ipc.renameFolder.mockRejectedValueOnce(
        new Error('Folder already exists'),
      );

      await expect(store.renameFolder('A', 'B')).rejects.toThrow(
        'Folder already exists',
      );
    });
  });

  // ================================================================
  // 6. STATE TRANSITION — Full lifecycle from empty to empty
  // ================================================================

  describe('State Transition: Empty → Populated → Empty', () => {
    it('should transition folder state from 0 → 3 → 0', async () => {
      // --- Start: empty ---
      expect(store.folders).toHaveLength(0);
      expect(store.folderNames).toEqual([]);

      // --- Create 3 folders ---
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([FOLDER_FIXTURES.technology]);
      await store.addFolder('Technology');
      expect(store.folders).toHaveLength(1);

      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([FOLDER_FIXTURES.technology, FOLDER_FIXTURES.science]);
      await store.addFolder('Science');
      expect(store.folders).toHaveLength(2);

      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        FOLDER_FIXTURES.technology,
        FOLDER_FIXTURES.science,
        FOLDER_FIXTURES.cjk,
      ]);
      await store.addFolder('中文科技');
      expect(store.folders).toHaveLength(3);

      // --- Delete all 3 ---
      ipc.removeFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        FOLDER_FIXTURES.science,
        FOLDER_FIXTURES.cjk,
      ]);
      await store.removeFolder('Technology');
      expect(store.folders).toHaveLength(2);

      ipc.removeFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([FOLDER_FIXTURES.cjk]);
      await store.removeFolder('Science');
      expect(store.folders).toHaveLength(1);

      ipc.removeFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([]);
      await store.removeFolder('中文科技');
      expect(store.folders).toHaveLength(0);
      expect(store.folderNames).toEqual([]);
    });
  });

  // ================================================================
  // 7. EQUIVALENCE CLASS — Name validation boundaries
  // ================================================================

  describe('Equivalence Class: Folder Name Validation', () => {
    it('should accept a folder name with CJK characters', async () => {
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        { id: 'f-cjk', name: '测试文件夹', feedCount: 0, parentId: null, order: 0 },
      ]);

      await store.addFolder('测试文件夹');
      expect(ipc.addFolderV2).toHaveBeenCalledWith('测试文件夹');
      expect(store.folderNames).toContain('测试文件夹');
    });

    it('should accept a folder name with emoji', async () => {
      const emojiName = '📁 Feeds 🚀';
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        { id: 'f-emoji', name: emojiName, feedCount: 0, parentId: null, order: 0 },
      ]);

      await store.addFolder(emojiName);
      expect(ipc.addFolderV2).toHaveBeenCalledWith(emojiName);
      expect(store.folderNames).toContain(emojiName);
    });

    it('should accept a numeric folder name', async () => {
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        { id: 'f-num', name: '12345', feedCount: 0, parentId: null, order: 0 },
      ]);

      await store.addFolder('12345');
      expect(ipc.addFolderV2).toHaveBeenCalledWith('12345');
    });

    it('should handle a folder name with special characters', async () => {
      const specialName = 'Tech & News + (2024)';
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        { id: 'f-special', name: specialName, feedCount: 0, parentId: null, order: 0 },
      ]);

      await store.addFolder(specialName);
      expect(ipc.addFolderV2).toHaveBeenCalledWith(specialName);
      expect(store.folderNames).toContain(specialName);
    });

    it('should handle DB error during folder creation', async () => {
      ipc.addFolderV2.mockRejectedValueOnce(
        new Error('DATABASE_ERROR: disk full'),
      );

      await expect(store.addFolder('New')).rejects.toThrow('disk full');

      // Note: folderStore.addFolder does NOT persist the error in store.error
      expect(store.error).toBeNull();
    });
  });

  // ================================================================
  // 8. COMPUTED PROPERTIES
  // ================================================================

  describe('Computed Properties After CRUD', () => {
    it('should correctly reflect folderExists as boolean', () => {
      store.folders = [
        FOLDER_FIXTURES.technology,
        FOLDER_FIXTURES.science,
      ];

      expect(store.folderExists('Technology')).toBe(true);
      expect(store.folderExists('Missing')).toBe(false);
      expect(store.folderExists('')).toBe(false);
    });

    it('should compute folderNames after multiple mutations', () => {
      store.folders = [
        { id: 'z', name: 'Z Folder', feedCount: 0, parentId: null, order: 2 },
        { id: 'a', name: 'A Folder', feedCount: 0, parentId: null, order: 0 },
        { id: 'm', name: 'M Folder', feedCount: 0, parentId: null, order: 1 },
      ];

      // folderNames preserves insertion order (no sort in store)
      expect(store.folderNames).toEqual(['Z Folder', 'A Folder', 'M Folder']);
    });

    it('should handle defaultFolderExists', () => {
      expect(store.defaultFolderExists).toBe(false);

      store.folders = [{ id: 'd', name: '默认', feedCount: 0, parentId: null, order: 0 }];

      expect(store.defaultFolderExists).toBe(true);
    });

    it('should clear error and loading state after successful operations', async () => {
      // Pre-set an error to verify it gets cleared on success
      store.error = 'previous failure';

      // Note: folderStore.addFolder does NOT persist error in store.error
      // so the error state is not set after a failed addFolder call.
      // Instead, verify that a successful operation resets error to null.

      // Succeed on retry
      ipc.addFolderV2.mockResolvedValueOnce(undefined);
      ipc.getFolders.mockResolvedValueOnce([
        { id: 'f-good', name: 'Good', feedCount: 0, parentId: null, order: 0 },
      ]);
      await store.addFolder('Good');

      // addFolder calls loadFolders internally which sets error to null
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.folderNames).toContain('Good');
    });
  });

  // ================================================================
  // 9. EQUIVALENCE CLASS — Whitespace & boundary folder names
  // ================================================================

  describe('Equivalence Class: Edge Case Folder Names', () => {
    it('should reject whitespace-only folder name', async () => {
      ipc.addFolderV2.mockRejectedValueOnce(
        new Error('INVALID_PARAM: folderName must not be whitespace-only'),
      );

      await expect(store.addFolder('   ')).rejects.toThrow('whitespace-only');
    });

    it('should reject folder name with path traversal', async () => {
      ipc.addFolderV2.mockRejectedValueOnce(
        new Error('INVALID_PARAM: folderName contains path traversal sequence (..)'),
      );

      await expect(store.addFolder('../escape')).rejects.toThrow('path traversal');
    });

    it('should reject folder name with directory separators', async () => {
      ipc.addFolderV2.mockRejectedValueOnce(
        new Error('INVALID_PARAM: folderName contains invalid characters'),
      );

      await expect(store.addFolder('folder/name')).rejects.toThrow('invalid characters');
    });

    it('should reject very long folder name', async () => {
      const longName = 'A'.repeat(300);
      ipc.addFolderV2.mockRejectedValueOnce(
        new Error('INVALID_PARAM: folderName exceeds max length 256'),
      );

      await expect(store.addFolder(longName)).rejects.toThrow('max length');
    });
  });
});
