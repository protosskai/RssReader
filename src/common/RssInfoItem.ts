export interface RssInfoItem {
  id: string,
  title: string,
  unread: number,
  htmlUrl: string,
  feedUrl: string,
  avatar?: string,
  lastUpdateTime?: string
}

export interface RssInfoNew {
  feedUrl: string,
  title?: string,
  folderName?: string
}

export interface RssFolderItem {
  folderName: string,
  data: RssInfoItem[],
  children: RssFolderItem[] // 子目录，暂不使用
}

