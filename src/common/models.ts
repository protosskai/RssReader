export interface Article {
  id: string;
  guid: string;
  feedId: string;
  folderName: string;
  title: string;
  summary: string;
  content: string;
  link: string;
  pubDate: string;
  read: boolean;
  favorite: boolean;
  author?: string;
}

export interface ArticleFilter {
  feedId?: string;
  folderName?: string;
  read?: boolean;
  favorite?: boolean;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

export interface ArticleStats {
  totalArticles: number;
  unreadCount: number;
  favoriteCount: number;
  feedCount: number;
  folderCount: number;
}

export interface FeedSource {
  id: string;
  title: string;
  feedUrl: string;
  folderName: string;
  unreadCount: number;
  lastSyncAt?: string;
}

export interface Folder {
  id: string;
  name: string;
  feedCount: number;
}

export interface ArticleQueryParams {
  filter?: ArticleFilter;
  offset?: number;
  limit?: number;
}
