import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";
import {ErrorMsg} from "src/common/ErrorMsg";
import {PostIndexItem} from "app/src-electron/storage/common";
import type { Article, ArticleFilter, ArticleStats } from 'src-electron/domain/models/Article';
import type { FeedSource } from 'src-electron/domain/models/Article';
import type { Folder } from 'src-electron/domain/models/Article';

export interface electronAPI {
  // 旧API（保留以向后兼容）
  addRssSubscription: (obj: RssInfoNew) => Promise<void>,
  removeRssSubscription: (folderName: string, rssUrl: string) => Promise<ErrorMsg>
  openLink: (url: string) => Promise<void>,
  close: () => void,
  minimize: () => void,
  addFolder: (folderName: string) => Promise<ErrorMsg>,
  removeFolder: (folderName: string) => Promise<ErrorMsg>
  importOpmlFile: () => Promise<ErrorMsg>,
  dumpFolderToDb: (folderInfoListJson: string) => Promise<ErrorMsg>,
  loadFolderFromDb: () => Promise<string>,
  getRssInfoListFromDb: () => Promise<RssFolderItem[]>,
  editFolder: (oldFolderName: string, newFolderName: string) => Promise<ErrorMsg>,
  queryPostIndexByRssId: (rssId: string) => Promise<PostIndexItem[]>,
  queryPostContentByGuid: (guid: string) => Promise<ContentInfo>,
  fetchRssIndexList: (rssId: string) => Promise<ErrorMsg>

  // 新API（基于Article架构）
  // Article operations
  getArticles: (params: { filter?: ArticleFilter, offset?: number, limit?: number }) => Promise<{ articles: Article[], total: number }>,
  getArticle: (id: string) => Promise<Article>,
  toggleReadStatus: (id: string) => Promise<void>,
  toggleFavorite: (id: string) => Promise<boolean>,
  markAllAsRead: (params?: { feedId?: string, folderName?: string }) => Promise<void>,
  clearAllFavorites: () => Promise<void>,
  getArticleStats: () => Promise<ArticleStats>,

  // Feed operations
  getFeeds: (folderName?: string) => Promise<FeedSource[]>,
  getFeed: (id: string) => Promise<FeedSource | null>,
  addFeed: (feedUrl: string, title?: string, folderName?: string) => Promise<void>,
  removeFeed: (id: string) => Promise<void>,
  syncFeed: (id: string) => Promise<void>,

  // Folder operations (new API v2)
  getFolders: () => Promise<Folder[]>,
  getFolder: (name: string) => Promise<Folder | null>,
  addFolderV2: (name: string) => Promise<void>,
  removeFolderV2: (name: string) => Promise<void>,
  renameFolder: (oldName: string, newName: string) => Promise<void>,

  // Favorite operations (legacy support)
  getFavoritePosts: () => Promise<PostIndexItem[]>,
  addFavoritePost: (post: any) => Promise<void>,
  removeFavoritePost: (guid: string) => Promise<void>,
  isPostFavorite: (guid: string) => Promise<boolean>
}

declare  global {
  interface Window {
    electronAPI: electronAPI
  }
}
