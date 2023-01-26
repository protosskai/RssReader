export interface RssInfoItem {
  id: number,
  title: string,
  unread: number,
  htmlUrl: string,
  feedUrl: string,
  avatar?: string,
  lastUpdateTime?: string
}

export interface RssFolderItem {
  folderName: string,
  data: RssInfoItem[],
  children: RssInfoItem[]
}

