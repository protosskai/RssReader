import {Source} from "app/src-electron/rss/sourceManage";

export interface ContentInfo {
  title: string,
  content: string,
  link: string,
  author?: string,
  updateTime?: string,
  rssSource?: Source
}
