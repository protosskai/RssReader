import type { Router } from 'vue-router';
import { router as exportedRouter } from 'src/router';

/** Resolve the live Vue Router instance reliably. */
function getRouter(): Router | null {
  if (exportedRouter) return exportedRouter;
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __APP_ROUTER__?: Router };
    if (w.__APP_ROUTER__) return w.__APP_ROUTER__;
  }
  return null;
}

/**
 * Navigate by route name.
 * Content page uses query params because article guids are often full URLs
 * (slashes / ? break path params).
 */
export const switchPage = (name: string, params?: Record<string, unknown>) => {
  const r = getRouter();
  if (!r) {
    console.error('[switchPage] router is null — using hash fallback for', name);
    // Last-resort hash navigation so clicks never hard-crash the app
    if (name === 'Home') {
      location.hash = '#/';
    } else if (name === 'PostList' && params?.RssId != null) {
      location.hash = `#/postList/${encodeURIComponent(String(params.RssId))}`;
    } else if (name === 'Content' && params) {
      const rssId = String(params.RssId ?? params.rssId ?? '');
      const postId = String(params.PostId ?? params.postId ?? '');
      location.hash =
        `#/content?rssId=${encodeURIComponent(rssId)}&postId=${encodeURIComponent(postId)}`;
    } else if (name === 'Setting') {
      location.hash = '#/setting';
    } else if (name === 'Favorite') {
      location.hash = '#/favorite';
    }
    return;
  }

  if (name === 'Content' && params) {
    const rssId = String(params.RssId ?? params.rssId ?? '');
    const postId = String(params.PostId ?? params.postId ?? '');
    void r.push({
      name: 'Content',
      query: { rssId, postId },
    });
    return;
  }

  void r.push({
    name,
    params: params as Record<string, string | string[]>,
  });
};

export const extractTextFromHtml = (html: string): string => {
  return html.replace(/<[^>]*(>|$)| |‌|»|«|>/g, '');
};

/**
 * Format a date string as a relative time description in Chinese.
 * e.g. "刚刚", "3分钟前", "2小时前", "5天前", "3周前", or a formatted date.
 */
export const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return '未知时间';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '未知时间';

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInWeeks = Math.floor(diffInDays / 7);

    if (diffInMinutes < 1) {
      return '刚刚';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`;
    } else if (diffInHours < 24) {
      return `${diffInHours}小时前`;
    } else if (diffInDays < 7) {
      return `${diffInDays}天前`;
    } else if (diffInWeeks < 4) {
      return `${diffInWeeks}周前`;
    } else {
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    }
  } catch {
    return '未知时间';
  }
};
