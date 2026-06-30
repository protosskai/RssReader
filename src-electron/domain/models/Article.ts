/**
 * Domain Model — re-exports from the canonical common models.
 *
 * These types are the domain-layer view of Article, FeedSource, Folder, etc.
 * The single source of truth lives in src/common/models.ts.
 *
 * @deprecated Import directly from 'src/common/models' for new code.
 */

import type {
  Article,
  FeedSource,
  Folder,
  ArticleFilter,
  ArticleStats,
} from 'src/common/models';

// Re-export everything from the canonical models
export type { Article, FeedSource, Folder, ArticleFilter, ArticleStats };
