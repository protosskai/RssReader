export interface PostInfoItem {
  postId: number,
  title: string,
  desc: string,
  read: boolean, // 是否已读
  author?: string,
  updateTime?: string
}
