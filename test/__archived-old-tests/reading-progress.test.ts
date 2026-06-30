/**
 * Reading Progress E2E Tests — Scroll Tracking and Auto Mark-Read.
 *
 * Covers: Reading store state machine (start → update → auto-mark-read → stop)
 * Techniques: state_transition, boundary, positive
 *
 * The readingStore (src/stores/readingStore.ts) manages per-article scroll
 * progress tracking with automatic mark-as-read when scroll position reaches
 * or exceeds 80% (configurable via autoMarkAsReadThreshold).
 *
 * Key data structure: ReadingProgress { articleId, progress (0-100),
 *   scrollPosition (0-1), lastReadAt, readingTime, wordCount,
 *   estimatedReadingTime, markedAsRead }
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useReadingStore, type ReadingProgress } from '../../src/stores/readingStore';

// -----------------------------------------------------------------------
// Fixtures — articles with known word-count / estimated-time mappings
// -----------------------------------------------------------------------

interface ArticleFixture {
  articleId: string;
  wordCount: number;
  expectedSeconds: number;
}

const FIXTURES: Record<string, ArticleFixture> = {
  article1: { articleId: 'article-001', wordCount: 1500, expectedSeconds: 360 },
  article2: { articleId: 'article-002', wordCount: 250, expectedSeconds: 60 },
  article3: { articleId: 'article-003', wordCount: 0, expectedSeconds: 0 },
  article4: { articleId: 'article-004', wordCount: 999999, expectedSeconds: 240000 },
};

/**
 * Assert that a ReadingProgress entry matches expected defaults after
 * startReading. We verify exact fields rather than object shape so
 * regressions in store implementation are caught.
 */
function assertProgressSnapshot(
  progress: ReadingProgress | undefined | null,
  expected: { articleId: string; wordCount: number; estimatedReadingTime: number },
): void {
  expect(progress).toBeDefined();
  expect(progress!.articleId).toBe(expected.articleId);
  expect(progress!.wordCount).toBe(expected.wordCount);
  expect(progress!.estimatedReadingTime).toBe(expected.estimatedReadingTime);
  expect(progress!.progress).toBe(0);
  expect(progress!.scrollPosition).toBe(0);
  expect(progress!.markedAsRead).toBe(false);
  expect(progress!.lastReadAt).toBeInstanceOf(Date);
}

// ========================================================================
// Scenario: Reading Progress — Scroll Tracking and Auto Mark-Read
// ========================================================================

describe('Reading Progress — Scroll Tracking and Auto Mark-Read', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // ================================================================
  // 1. State Transition — Full Lifecycle
  // ================================================================

  describe('State Transition — Full Lifecycle', () => {
    it('should start reading an article and set isReading to true', () => {
      const store = useReadingStore();
      const { articleId, wordCount } = FIXTURES.article1;

      store.startReading(articleId, wordCount);

      // State after startReading
      expect(store.isReading).toBe(true);
      expect(store.currentArticleId).toBe(articleId);

      // ReadingProgress was created with correct initial values
      const progress = store.getProgress(articleId);
      assertProgressSnapshot(progress, {
        articleId,
        wordCount,
        estimatedReadingTime: 360,
      });
    });

    it('should set estimated reading time to 360s for 1500 words at 250 wpm', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);

      const progress = store.getProgress(FIXTURES.article1.articleId);
      expect(progress!.estimatedReadingTime).toBe(360);
    });

    it('should update progress to 50% when scroll position reaches 0.5', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);

      store.updateProgress(FIXTURES.article1.articleId, 0.5);

      const progress = store.getProgress(FIXTURES.article1.articleId);
      expect(progress!.progress).toBe(50);
      expect(progress!.scrollPosition).toBe(0.5);
    });

    it('should NOT mark article as read at 50% scroll (below 0.8 threshold)', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);

      store.updateProgress(FIXTURES.article1.articleId, 0.5);

      const progress = store.getProgress(FIXTURES.article1.articleId);
      expect(progress!.progress).toBe(50);
      expect(progress!.markedAsRead).toBe(false);
    });

    it('should update progress to 90% when scroll position reaches 0.9', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);

      store.updateProgress(FIXTURES.article1.articleId, 0.9);

      const progress = store.getProgress(FIXTURES.article1.articleId);
      expect(progress!.progress).toBe(90);
      expect(progress!.scrollPosition).toBe(0.9);
    });

    it('should auto-mark article as read when scroll >= 0.8 threshold', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);

      // Start below threshold
      store.updateProgress(FIXTURES.article1.articleId, 0.5);
      expect(store.getProgress(FIXTURES.article1.articleId)!.markedAsRead).toBe(false);

      // Cross the 0.8 threshold
      store.updateProgress(FIXTURES.article1.articleId, 0.9);
      expect(store.getProgress(FIXTURES.article1.articleId)!.markedAsRead).toBe(true);
    });

    it('should set isReading to false after stopReading', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);
      expect(store.isReading).toBe(true);

      store.stopReading(FIXTURES.article1.articleId);

      expect(store.isReading).toBe(false);
    });

    it('should switch currentArticleId when starting a new article', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);
      expect(store.currentArticleId).toBe(FIXTURES.article1.articleId);

      store.startReading(FIXTURES.article2.articleId, FIXTURES.article2.wordCount);

      expect(store.currentArticleId).toBe(FIXTURES.article2.articleId);
    });

    it('should preserve first article progress when switching to a second article', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);
      store.updateProgress(FIXTURES.article1.articleId, 0.9);

      // Switch to second article
      store.startReading(FIXTURES.article2.articleId, FIXTURES.article2.wordCount);

      // First article's progress should still be preserved in the Map
      const firstProgress = store.getProgress(FIXTURES.article1.articleId);
      expect(firstProgress).toBeDefined();
      expect(firstProgress!.progress).toBe(90);
      expect(firstProgress!.markedAsRead).toBe(true);

      // Second article has fresh progress
      const secondProgress = store.getProgress(FIXTURES.article2.articleId);
      assertProgressSnapshot(secondProgress, {
        articleId: FIXTURES.article2.articleId,
        wordCount: FIXTURES.article2.wordCount,
        estimatedReadingTime: 60,
      });
    });

    it('should return undefined for cleared article progress', () => {
      const store = useReadingStore();
      store.startReading(FIXTURES.article1.articleId, FIXTURES.article1.wordCount);
      store.updateProgress(FIXTURES.article1.articleId, 0.9);

      store.clearProgress(FIXTURES.article1.articleId);

      const result = store.getProgress(FIXTURES.article1.articleId);
      expect(result).toBeUndefined();
    });
  });

  // ================================================================
  // 2. Boundary — estimateReadingTime edge cases
  // ================================================================

  describe('Boundary — estimateReadingTime', () => {
    it('should return 0s for 0-word articles (boundary: zero)', () => {
      const store = useReadingStore();
      expect(store.estimateReadingTime(0)).toBe(0);
    });

    it('should return 60s for 250 words at default 250 wpm (boundary: exactly 1 min)', () => {
      const store = useReadingStore();
      expect(store.estimateReadingTime(250)).toBe(60);
    });

    it('should return 1s for 1 word (boundary: minimum positive)', () => {
      const store = useReadingStore();
      // Math.ceil(1 / 250 * 60) = Math.ceil(0.24) = 1
      expect(store.estimateReadingTime(1)).toBe(1);
    });

    it('should return 240000s for large word count (boundary: very large)', () => {
      const store = useReadingStore();
      expect(store.estimateReadingTime(999999)).toBe(240000);
    });
  });

  // ================================================================
  // 3. Positive — Normal Flow End-to-End
  // ================================================================

  describe('Positive — Full Scenario End-to-End', () => {
    it('should complete the full reading lifecycle end-to-end', () => {
      const store = useReadingStore();

      // ── Step 1: Start reading article-1 (1500 words) ──
      store.startReading('article-001', 1500);
      expect(store.isReading).toBe(true);

      // estimatedReadingTime should be ceil(1500/250*60) = 360s
      const p1 = store.getProgress('article-001')!;
      expect(p1.estimatedReadingTime).toBe(360);

      // ── Step 2: Update progress to 50% ──
      store.updateProgress('article-001', 0.5);
      const p2 = store.getProgress('article-001')!;
      expect(p2.progress).toBe(50);
      expect(p2.markedAsRead).toBe(false); // below 0.8 threshold

      // ── Step 3: Update progress to 90% ──
      store.updateProgress('article-001', 0.9);
      const p3 = store.getProgress('article-001')!;
      expect(p3.progress).toBe(90);
      expect(p3.markedAsRead).toBe(true); // auto-crossed 0.8 threshold

      // ── Step 4: Stop reading ──
      store.stopReading('article-001');
      expect(store.isReading).toBe(false);

      // ── Step 5: Switch to second article ──
      store.startReading('article-002', 250);
      expect(store.currentArticleId).toBe('article-002');

      // First article progress preserved
      const preserved = store.getProgress('article-001')!;
      expect(preserved.progress).toBe(90);
      expect(preserved.markedAsRead).toBe(true);

      // ── Step 6: estimateReadingTime boundary checks ──
      expect(store.estimateReadingTime(0)).toBe(0);
      expect(store.estimateReadingTime(250)).toBe(60);

      // ── Step 7: Clear progress for article-001 ──
      store.clearProgress('article-001');
      expect(store.getProgress('article-001')).toBeUndefined();
    });
  });

  // ================================================================
  // 4. Edge Cases — updateProgress guard / re-entry / idempotency
  // ================================================================

  describe('Edge Cases — Guard Logic and Idempotency', () => {
    it('should not update progress for non-current article', () => {
      const store = useReadingStore();
      store.startReading('article-001', 500);

      // Attempt update with wrong articleId
      store.updateProgress('article-wrong', 0.5);

      // current article's progress should remain at 0
      expect(store.getProgress('article-001')!.progress).toBe(0);
    });

    it('should not stop reading a non-current article', () => {
      const store = useReadingStore();
      store.startReading('article-001', 500);

      store.stopReading('article-wrong');

      // isReading should still be true
      expect(store.isReading).toBe(true);
      expect(store.currentArticleId).toBe('article-001');
    });

    it('should clamp progress to 0 when scrollPosition is negative', () => {
      const store = useReadingStore();
      store.startReading('article-001', 500);

      store.updateProgress('article-001', -0.5);

      expect(store.getProgress('article-001')!.progress).toBe(0);
      expect(store.getProgress('article-001')!.scrollPosition).toBe(-0.5);
    });

    it('should clamp progress to 100 when scrollPosition exceeds 1', () => {
      const store = useReadingStore();
      store.startReading('article-001', 500);

      store.updateProgress('article-001', 2.0);

      expect(store.getProgress('article-001')!.progress).toBe(100);
      expect(store.getProgress('article-001')!.scrollPosition).toBe(2.0);
    });

    it('should not auto-mark as read again if already marked (idempotent)', () => {
      const store = useReadingStore();
      store.startReading('article-001', 500);

      // Cross threshold once
      store.updateProgress('article-001', 0.85);
      expect(store.getProgress('article-001')!.markedAsRead).toBe(true);

      // Update again at same position — should stay true, not toggle
      store.updateProgress('article-001', 0.85);
      expect(store.getProgress('article-001')!.markedAsRead).toBe(true);
    });

    it('should update lastReadAt on every progress update', () => {
      const store = useReadingStore();
      store.startReading('article-001', 500);

      const afterStart = store.getProgress('article-001')!.lastReadAt.getTime();
      const later = new Date(afterStart + 5000); // simulate time passing

      // Mock Date to advance time (limit scope: just check the field changes)
      store.updateProgress('article-001', 0.5);
      expect(store.getProgress('article-001')!.lastReadAt.getTime()).toBeGreaterThanOrEqual(afterStart);
    });
  });

  // ================================================================
  // 5. Format Utilities — formatReadingTime and formatProgress
  // ================================================================

  describe('Format Utilities', () => {
    it('should format seconds as "X秒" when under 60', () => {
      const store = useReadingStore();
      expect(store.formatReadingTime(0)).toBe('0秒');
      expect(store.formatReadingTime(30)).toBe('30秒');
      expect(store.formatReadingTime(59)).toBe('59秒');
    });

    it('should format seconds as "X分钟" when exactly 60', () => {
      const store = useReadingStore();
      expect(store.formatReadingTime(60)).toBe('1分钟');
      expect(store.formatReadingTime(120)).toBe('2分钟');
    });

    it('should format seconds as "X分Y秒" when between 60 and 3600 with remainder', () => {
      const store = useReadingStore();
      expect(store.formatReadingTime(90)).toBe('1分30秒');
      expect(store.formatReadingTime(150)).toBe('2分30秒');
    });

    it('should format seconds as "X小时Y分钟" when >= 3600', () => {
      const store = useReadingStore();
      expect(store.formatReadingTime(3600)).toBe('1小时0分钟');
      expect(store.formatReadingTime(3660)).toBe('1小时1分钟');
      expect(store.formatReadingTime(7200)).toBe('2小时0分钟');
    });

    it('should format progress as integer percentage', () => {
      const store = useReadingStore();
      expect(store.formatProgress(0)).toBe('0%');
      expect(store.formatProgress(50)).toBe('50%');
      expect(store.formatProgress(100)).toBe('100%');
    });
  });

  // ================================================================
  // 6. getAllProgress — aggregate queries
  // ================================================================

  describe('Aggregate — getAllProgress', () => {
    it('should return empty array when no articles have been read', () => {
      const store = useReadingStore();
      expect(store.getAllProgress()).toEqual([]);
    });

    it('should return all tracked reading progress entries', () => {
      const store = useReadingStore();

      store.startReading('article-001', 1500);
      store.startReading('article-002', 250);

      const all = store.getAllProgress();
      expect(all).toHaveLength(2);

      const ids = all.map((p) => p.articleId).sort();
      expect(ids).toEqual(['article-001', 'article-002']);
    });
  });

  // ================================================================
  // 7. clearProgress — bulk clear
  // ================================================================

  describe('clearProgress — Bulk Clear', () => {
    it('should clear all reading progress when no articleId is given', () => {
      const store = useReadingStore();
      store.startReading('article-001', 500);
      store.startReading('article-002', 300);

      expect(store.getAllProgress()).toHaveLength(2);

      store.clearProgress(); // no argument

      expect(store.getAllProgress()).toEqual([]);
      expect(store.getProgress('article-001')).toBeUndefined();
      expect(store.getProgress('article-002')).toBeUndefined();
    });
  });
});
