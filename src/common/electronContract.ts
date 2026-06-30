import { ContentInfo, PostIndexItem, RssFolderItem, RssInfoNew } from 'src/common/models';
import { ApiResponse, ErrorMsg } from 'src/common/ErrorMsg';
import {
  Article,
  ArticleQueryParams,
  ArticleStats,
  FeedSource,
  Folder,
} from 'src/common/models';

export interface ElectronContract {
  // --- Legacy RSS API (wrapped in ApiResponse) ---
  addRssSubscription: (obj: RssInfoNew) => Promise<ApiResponse<void>>;
  removeRssSubscription: (folderName: string, rssUrl: string) => Promise<ApiResponse<void>>;
  openLink: (url: string) => Promise<void>;
  close: () => void;
  minimize: () => void;
  addFolder: (folderName: string) => Promise<ApiResponse<void>>;
  removeFolder: (folderName: string) => Promise<ApiResponse<void>>;
  importOpmlFile: () => Promise<ApiResponse<void>>;
  dumpFolderToDb: (folderInfoListJson: string) => Promise<ErrorMsg>;
  loadFolderFromDb: () => Promise<ApiResponse<string>>;
  getRssInfoListFromDb: () => Promise<ApiResponse<RssFolderItem[]>>;
  editFolder: (oldFolderName: string, newFolderName: string) => Promise<ApiResponse<void>>;
  queryPostIndexByRssId: (rssId: string) => Promise<ApiResponse<PostIndexItem[]>>;
  queryPostContentByGuid: (guid: string) => Promise<ApiResponse<ContentInfo>>;
  fetchRssIndexList: (rssId: string) => Promise<ApiResponse<void>>;

  // --- New Article API ---
  getArticles: (params: ArticleQueryParams) => Promise<{ articles: Article[]; total: number }>;
  getArticle: (id: string) => Promise<Article>;
  toggleReadStatus: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  markAllAsRead: (params?: { feedId?: string; folderName?: string }) => Promise<void>;
  clearAllFavorites: () => Promise<void>;
  getArticleStats: () => Promise<ArticleStats>;

  // --- New Feed API ---
  getFeeds: (folderName?: string) => Promise<FeedSource[]>;
  getFeed: (id: string) => Promise<FeedSource | null>;
  addFeed: (feedUrl: string, title?: string, folderName?: string) => Promise<void>;
  removeFeed: (id: string) => Promise<void>;
  syncFeed: (id: string) => Promise<void>;

  // --- New Folder API ---
  getFolders: () => Promise<Folder[]>;
  getFolder: (name: string) => Promise<Folder | null>;
  addFolderV2: (name: string) => Promise<void>;
  removeFolderV2: (name: string) => Promise<void>;
  renameFolder: (oldName: string, newName: string) => Promise<void>;

  // --- Favorites API ---
  getFavoritePosts: () => Promise<PostIndexItem[]>;
  addFavoritePost: (post: unknown) => Promise<void>;
  removeFavoritePost: (guid: string) => Promise<void>;
  isPostFavorite: (guid: string) => Promise<boolean>;

  // --- Sync API ---
  syncGetConfig: () => Promise<unknown>;
  syncUpdateConfig: (config: unknown) => Promise<unknown>;
  syncStart: () => Promise<unknown>;
  syncGetStatus: () => Promise<unknown>;
  syncStartAuto: () => Promise<unknown>;
  syncStopAuto: () => Promise<unknown>;

  // --- Search API ---
  searchPosts: (
    query: string,
    options?: {
      folderId?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
  ) => Promise<ApiResponse<PostIndexItem[]>>;
}
