import { ContentInfo } from 'src/common/ContentInfo';
import { ErrorMsg } from 'src/common/ErrorMsg';
import { PostIndexItem } from 'src-electron/storage/common';
import { RssFolderItem, RssInfoNew } from 'src/common/RssInfoItem';
import {
  Article,
  ArticleQueryParams,
  ArticleStats,
  FeedSource,
  Folder,
} from 'src/common/models';

export interface ElectronContract {
  addRssSubscription: (obj: RssInfoNew) => Promise<void>;
  removeRssSubscription: (folderName: string, rssUrl: string) => Promise<ErrorMsg>;
  openLink: (url: string) => Promise<void>;
  close: () => void;
  minimize: () => void;
  addFolder: (folderName: string) => Promise<ErrorMsg>;
  removeFolder: (folderName: string) => Promise<ErrorMsg>;
  importOpmlFile: () => Promise<ErrorMsg>;
  dumpFolderToDb: (folderInfoListJson: string) => Promise<ErrorMsg>;
  loadFolderFromDb: () => Promise<string>;
  getRssInfoListFromDb: () => Promise<RssFolderItem[]>;
  editFolder: (oldFolderName: string, newFolderName: string) => Promise<ErrorMsg>;
  queryPostIndexByRssId: (rssId: string) => Promise<PostIndexItem[]>;
  queryPostContentByGuid: (guid: string) => Promise<ContentInfo>;
  fetchRssIndexList: (rssId: string) => Promise<ErrorMsg>;

  getArticles: (params: ArticleQueryParams) => Promise<{ articles: Article[]; total: number }>;
  getArticle: (id: string) => Promise<Article>;
  toggleReadStatus: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  markAllAsRead: (params?: { feedId?: string; folderName?: string }) => Promise<void>;
  clearAllFavorites: () => Promise<void>;
  getArticleStats: () => Promise<ArticleStats>;

  getFeeds: (folderName?: string) => Promise<FeedSource[]>;
  getFeed: (id: string) => Promise<FeedSource | null>;
  addFeed: (feedUrl: string, title?: string, folderName?: string) => Promise<void>;
  removeFeed: (id: string) => Promise<void>;
  syncFeed: (id: string) => Promise<void>;

  getFolders: () => Promise<Folder[]>;
  getFolder: (name: string) => Promise<Folder | null>;
  addFolderV2: (name: string) => Promise<void>;
  removeFolderV2: (name: string) => Promise<void>;
  renameFolder: (oldName: string, newName: string) => Promise<void>;

  getFavoritePosts: () => Promise<PostIndexItem[]>;
  addFavoritePost: (post: unknown) => Promise<void>;
  removeFavoritePost: (guid: string) => Promise<void>;
  isPostFavorite: (guid: string) => Promise<boolean>;

  syncGetConfig: () => Promise<unknown>;
  syncUpdateConfig: (config: unknown) => Promise<unknown>;
  syncStart: () => Promise<unknown>;
  syncGetStatus: () => Promise<unknown>;
  syncStartAuto: () => Promise<unknown>;
  syncStopAuto: () => Promise<unknown>;

  searchPosts: (
    query: string,
    options?: {
      folderId?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    }
  ) => Promise<PostIndexItem[]>;
}
