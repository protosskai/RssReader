/**
 * Real ArticleService.setReadStatus path — idempotent mark-read.
 * Drives the shipped service method with lightweight in-memory repos.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleService } from '../../src-electron/application/services/ArticleService';
import type { Article } from '../../src/common/models';
import type {
  ArticleRepository,
  FeedRepository,
  FolderRepository,
} from '../../src-electron/domain/repositories/Interfaces';
import fs from 'fs';
import path from 'path';

function makeArticle(overrides: Partial<Article> & { id: string }): Article {
  const now = new Date();
  return {
    id: overrides.id,
    guid: overrides.guid ?? overrides.id,
    title: overrides.title ?? 't',
    content: overrides.content ?? '',
    link: overrides.link ?? 'https://example.com',
    author: overrides.author ?? '',
    feedId: overrides.feedId ?? 'feed1',
    feedTitle: overrides.feedTitle ?? 'F',
    feedUrl: overrides.feedUrl ?? 'https://example.com/feed',
    folderName: overrides.folderName ?? '默认',
    avatar: overrides.avatar ?? '',
    pubDate: overrides.pubDate ?? now.toISOString(),
    publishDate: overrides.publishDate ?? now,
    updateTime: overrides.updateTime ?? now,
    description: overrides.description ?? '',
    summary: overrides.summary ?? '',
    read: overrides.read ?? false,
    favorite: overrides.favorite ?? false,
  };
}

describe('ArticleService.setReadStatus (idempotent open path)', () => {
  let articles: Map<string, Article>;
  let markCalls: Array<{ id: string; read: boolean }>;
  let unreadDelta: number;
  let service: ArticleService;

  beforeEach(() => {
    articles = new Map();
    markCalls = [];
    unreadDelta = 0;

    const articleRepo = {
      getArticleById: async (id: string) => articles.get(id) ?? null,
      markAsRead: async (id: string, read: boolean) => {
        markCalls.push({ id, read });
        const a = articles.get(id);
        if (a) articles.set(id, { ...a, read });
      },
      getArticleStats: async () => ({
        totalArticles: articles.size,
        unreadCount: [...articles.values()].filter((a) => !a.read).length,
        favoriteCount: 0,
        feedCount: 1,
        folderCount: 1,
      }),
    } as unknown as ArticleRepository;

    const feedRepo = {
      decrementUnreadCount: async () => {
        unreadDelta -= 1;
      },
      incrementUnreadCount: async () => {
        unreadDelta += 1;
      },
    } as unknown as FeedRepository;

    const folderRepo = {} as FolderRepository;

    service = new ArticleService(articleRepo, feedRepo, folderRepo);
  });

  it('marks unread → read with a single markAsRead(true)', async () => {
    articles.set('g1', makeArticle({ id: 'g1', read: false }));
    const result = await service.setReadStatus('g1', true);
    expect(result).toBe(true);
    expect(markCalls).toEqual([{ id: 'g1', read: true }]);
    expect(articles.get('g1')!.read).toBe(true);
    expect(unreadDelta).toBe(-1);
  });

  it('is idempotent: second setReadStatus(true) does not flip or re-write', async () => {
    articles.set('g1', makeArticle({ id: 'g1', read: false }));
    await service.setReadStatus('g1', true);
    await service.setReadStatus('g1', true);
    await service.setReadStatus('g1', true);
    expect(markCalls).toEqual([{ id: 'g1', read: true }]);
    expect(articles.get('g1')!.read).toBe(true);
    expect(unreadDelta).toBe(-1);
  });

  it('survives concurrent open-path calls without ending unread', async () => {
    articles.set('g1', makeArticle({ id: 'g1', read: false }));
    await Promise.all([
      service.setReadStatus('g1', true),
      service.setReadStatus('g1', true),
    ]);
    // Final state must be read. Concurrent callers may both write true
    // (both observed unread before either finished) — never a flip to unread.
    expect(articles.get('g1')!.read).toBe(true);
    expect(markCalls.every((c) => c.read === true)).toBe(true);
    expect(markCalls.some((c) => c.read === false)).toBe(false);
  });

  it('double toggle leaves unread — why open path must use setReadStatus', async () => {
    articles.set('g1', makeArticle({ id: 'g1', read: false }));
    await service.toggleReadStatus('g1');
    expect(articles.get('g1')!.read).toBe(true);
    await service.toggleReadStatus('g1');
    expect(articles.get('g1')!.read).toBe(false);
    expect(markCalls).toEqual([
      { id: 'g1', read: true },
      { id: 'g1', read: false },
    ]);
  });
});

describe('Open-article UI wiring (structural, real sources)', () => {
  const root = path.resolve(__dirname, '../..');

  it('PostListItem open click does not call toggle/setRead IPC', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/components/PostListItem.vue'),
      'utf-8',
    );
    const handleBlock = src.slice(
      src.indexOf('const handleCardClick'),
      src.indexOf('const openContextMenu'),
    );
    expect(handleBlock).not.toMatch(/toggleReadStatus|setReadStatus|electronClient/);
    expect(handleBlock).toMatch(/openContentPage/);
  });

  it('Content open path uses setReadStatus(true), not toggleReadStatus', () => {
    const src = fs.readFileSync(path.join(root, 'src/pages/Content.vue'), 'utf-8');
    expect(src).toMatch(/setReadStatus\(\s*postIdToFetch\s*,\s*true\s*\)/);
    const loadBlock = src.slice(
      src.indexOf('const getContentById'),
      src.indexOf('const goBack'),
    );
    expect(loadBlock).not.toMatch(/toggleReadStatus/);
  });
});
