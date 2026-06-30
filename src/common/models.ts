// ============================================================================
// Canonical Domain Models — single source of truth for all data types.
// Other files re-export from here.  Do NOT add overlapping definitions
// elsewhere.
// ============================================================================

// ── Article ────────────────────────────────────────────────────────────────

export interface Article {
  id: string;                    // GUID
  guid: string;                  // Alias for id (compatibility)
  feedId: string;                // RSS source ID
  folderName: string;            // Folder name
  title: string;                 // Article title
  content: string;               // HTML content
  description: string;           // Plain-text / truncated description
  summary: string;               // Alias for description
  link: string;                  // Original article URL
  pubDate: string;               // Publication date (ISO string)
  publishDate: Date;             // Alias for pubDate as Date
  updateTime: Date;              // Last update time
  read: boolean;                 // Read status
  favorite: boolean;             // Favorite status
  author?: string;               // Author
  feedTitle: string;             // RSS source title (denormalized)
  feedUrl: string;               // RSS source URL
  avatar?: string;               // RSS source avatar
}

export interface ArticleFilter {
  folderName?: string;
  feedId?: string;
  read?: boolean;
  favorite?: boolean;
  author?: string;
  keyword?: string;
  startDate?: string;            // ISO string
  endDate?: string;              // ISO string
  sortBy?: 'publishDate' | 'updateTime' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface ArticleQueryParams {
  filter?: ArticleFilter;
  offset?: number;
  limit?: number;
}
export interface ArticleStats {
  totalArticles: number;
  unreadCount: number;
  favoriteCount: number;
  feedCount: number;
  folderCount: number;
}

// ── Feed Source (RSS subscription) ─────────────────────────────────────────

export interface FeedSource {
  id: string;                    // RSS source ID
  rssId?: string;                // Alias for id
  title: string;                 // Feed title
  url: string;                   // Feed URL
  feedUrl: string;               // Alias for url
  htmlUrl: string;               // Website URL
  avatar: string;                // Icon / favicon
  folderName: string;            // Parent folder name
  lastUpdateTime?: Date;         // Last sync time
  unreadCount: number;           // Unread article count
  /** ETag from last fetch (for conditional HTTP requests) */
  etag?: string;
  /** Last-Modified from last fetch (for conditional HTTP requests) */
  lastModified?: string;
}

/**
 * Legacy RSS info item used by storage layer.
 *
 * Differs from FeedSource:
 *  - uses `unread` (number) instead of `unreadCount`
 *  - uses `avatar?` (optional) instead of `avatar` (required)
 *  - uses `lastUpdateTime?: string` instead of `lastUpdateTime?: Date`
 *  - has no `url`, `folderName`, `unreadCount` fields
 */
export interface RssInfoItem {
  id: string;
  title: string;
  unread: number;
  htmlUrl: string;
  feedUrl: string;
  avatar?: string;
  lastUpdateTime?: string;
  /** ETag from last fetch (for conditional requests) */
  etag?: string;
  /** Last-Modified from last fetch (for conditional requests) */
  lastModified?: string;
}

export interface RssInfoNew {
  feedUrl: string;
  title?: string;
  folderName?: string;
}

export interface RssFolderItem {
  folderName: string;
  data: RssInfoItem[];
  children: RssFolderItem[];
}

// ── Folder ─────────────────────────────────────────────────────────────────

export interface Folder {
  id: string;
  name: string;
  feedCount: number;
  parentId?: string;             // Support nested folders
  order: number;                 // Sort order
}

// ── Post / Content ─────────────────────────────────────────────────────────

export interface PostInfoItem {
  /** Optional — only set for existing DB records; feed-parsed items lack this. */
  postId?: number;
  title: string;
  link: string;
  desc: string;
  read: boolean;
  author: string;
  updateTime: string;
  guid: string;
}

export interface PostIndexItem {
  title: string;
  guid: string;
  link: string;
  author: string;
  updateTime: string;
  read: boolean;
  desc: string;
  rssId?: string;
}

export interface ContentInfo {
  title: string;
  content: string;
  link: string;
  author?: string;
  updateTime?: string;
  rssId: string;
  rssSource?: any;               // Loose type for Source object
  read?: number;                  // 0/1 DB value
  favorite?: number;              // 0/1 DB value
}

// ── Storage ────────────────────────────────────────────────────────────────

export interface SearchOptions {
  folderId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

// ── API Response Wrappers ──────────────────────────────────────────────────

export interface ErrorMsg {
  success: boolean;
  msg: string;
}

export interface ErrorData<T> {
  success: boolean;
  msg: string;
  data: T;
}
