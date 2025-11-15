/**
 * SqliteUtil V2 - 带并发控制的增强版本
 * 修复了并发访问问题，添加了读写锁和操作队列
 */

import {PostIndexItem, StorageUtil} from "app/src-electron/storage/common";
import {RssFolderItem} from "src/common/RssInfoItem";
import {ErrorData, ErrorMsg} from "src/common/ErrorMsg";
import {PostInfoItem} from "src/common/PostInfoItem";
import {extractTextFromHtml, beautyStr, convertStringToBase64, parseBase64ToString} from 'src-electron/util/string';
import {ContentInfo} from "src/common/ContentInfo";
import { SqliteHelper } from './SqliteHelper';

export class SqliteUtilV2 implements StorageUtil {
  private dbHelper: SqliteHelper;
  private static instance: SqliteUtilV2 | null = null;

  static getInstance(): SqliteUtilV2 {
    if (SqliteUtilV2.instance === null) {
      SqliteUtilV2.instance = new SqliteUtilV2();
    }
    return SqliteUtilV2.instance;
  }

  private constructor() {
    this.dbHelper = SqliteHelper.getInstance();
  }

  async init(): Promise<void> {
    await this.dbHelper.init();
  }

  // ========== 文件夹操作 ==========

  async dumpFolderItemList(folderInfoList: RssFolderItem[]): Promise<ErrorMsg> {
    try {
      await this.dbHelper.batch([
        async () => {
          // 先清空现有数据
          await this.dbHelper.run('DELETE FROM folder_info');
          await this.dbHelper.run('DELETE FROM rss_info');
        },
        async () => {
          // 重新插入数据
          for (const folderItem of folderInfoList) {
            // 插入文件夹
            await this.dbHelper.run(
              'INSERT OR IGNORE INTO folder_info (name) VALUES (?)',
              [folderItem.folderName]
            );

            // 获取文件夹ID
            const folder = await this.dbHelper.get<{id: number}>(
              'SELECT id FROM folder_info WHERE name = ?',
              [folderItem.folderName]
            );

            if (folder) {
              // 插入RSS信息
              for (const rssInfo of folderItem.data) {
                await this.dbHelper.run(
                  `INSERT OR REPLACE INTO rss_info
                   (rss_id, folder_id, title, html_url, feed_url, avatar, update_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    rssInfo.id,
                    folder.id,
                    rssInfo.title,
                    rssInfo.htmlUrl,
                    rssInfo.feedUrl,
                    rssInfo.avatar || '',
                    rssInfo.lastUpdateTime || new Date().toISOString()
                  ]
                );
              }
            }
          }
        }
      ]);

      return { success: true, msg: '' };
    } catch (error) {
      console.error('dumpFolderItemList error:', error);
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async loadFolderItemList(): Promise<ErrorData<RssFolderItem[]>> {
    try {
      const folderList = await this.dbHelper.all<{id: number, name: string}>(
        'SELECT id, name FROM folder_info ORDER BY name'
      );

      const folderInfoList: RssFolderItem[] = [];

      for (const folder of folderList) {
        const rssList = await this.dbHelper.all<{
          id: string;
          title: string;
          html_url: string;
          feed_url: string;
          avatar: string;
          update_time: string;
        }>(
          'SELECT rss_id as id, title, html_url, feed_url, avatar, update_time FROM rss_info WHERE folder_id = ?',
          [folder.id]
        );

        folderInfoList.push({
          folderName: folder.name,
          data: rssList.map(rss => ({
            id: rss.id,
            title: rss.title,
            unread: 0,
            htmlUrl: rss.html_url,
            feedUrl: rss.feed_url,
            avatar: rss.avatar,
            lastUpdateTime: rss.update_time
          })),
          children: []
        });
      }

      return {
        success: true,
        msg: '',
        data: folderInfoList
      };
    } catch (error) {
      console.error('loadFolderItemList error:', error);
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
        data: []
      };
    }
  }

  // ========== 文章操作 ==========

  async syncRssPostList(rssId: string, postInfoItemList: PostInfoItem[]): Promise<ErrorMsg> {
    try {
      // 批量插入新文章，使用事务保证一致性
      await this.dbHelper.batch([
        async () => {
          // 获取现有的guid列表
          const existingRows = await this.dbHelper.all<{guid: string}>(
            'SELECT guid FROM post_info WHERE rss_id = ?',
            [rssId]
          );
          const existingGuids = new Set(existingRows.map(row => row.guid));

          let newArticleCount = 0;

          // 插入新文章（只插入不存在的）
          for (const item of postInfoItemList) {
            if (!existingGuids.has(item.guid)) {
              await this.dbHelper.run(
                `INSERT INTO post_info (rss_id, title, author, link, content, guid, read, favorite, update_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  rssId,
                  item.title,
                  item.author,
                  item.link,
                  convertStringToBase64(item.desc),
                  item.guid,
                  item.read ? 1 : 0,
                  0, // 默认不是收藏
                  item.updateTime
                ]
              );
              newArticleCount++;
            }
          }

          console.log(`同步完成: RSS源 ${rssId} 添加了 ${newArticleCount} 篇新文章`);
        }
      ]);

      return { success: true, msg: '' };
    } catch (error) {
      console.error('syncRssPostList error:', error);
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async queryPostIndexByRssId(rssId: string): Promise<ErrorData<PostIndexItem[]>> {
    try {
      const rows = await this.dbHelper.all<{
        title: string;
        guid: string;
        link: string;
        author: string;
        update_time: string;
        read: number;
        content: string;
      }>(
        `SELECT title, guid, link, author, update_time, read, content
         FROM post_info WHERE rss_id = ? ORDER BY update_time DESC`,
        [rssId]
      );

      const result: PostIndexItem[] = rows.map(row => {
        let desc = parseBase64ToString(row.content);
        desc = beautyStr(extractTextFromHtml(desc), 100);

        return {
          title: row.title,
          guid: row.guid,
          link: row.link,
          author: row.author,
          updateTime: row.update_time,
          read: row.read === 1,
          desc
        };
      });

      return {
        success: true,
        msg: '',
        data: result
      };
    } catch (error) {
      console.error('queryPostIndexByRssId error:', error);
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
        data: []
      };
    }
  }

  async queryPostContentByGuid(guid: string): Promise<ErrorData<ContentInfo>> {
    try {
      // 先尝试通过guid查询
      let row = await this.dbHelper.get<{
        rss_id: string;
        title: string;
        content: string;
        link: string;
        author: string;
        update_time: string;
      }>(
        'SELECT rss_id, title, content, link, author, update_time FROM post_info WHERE guid = ?',
        [guid]
      );

      // 如果没找到，尝试通过link查询
      if (!row) {
        row = await this.dbHelper.get<{
          rss_id: string;
          title: string;
          content: string;
          link: string;
          author: string;
          update_time: string;
        }>(
          'SELECT rss_id, title, content, link, author, update_time FROM post_info WHERE link = ?',
          [guid]
        );
      }

      if (!row) {
        return {
          success: false,
          msg: `guid或link【${guid}】不存在!`,
          data: "" as any
        };
      }

      const contentInfo: ContentInfo = {
        title: row.title,
        content: parseBase64ToString(row.content),
        link: row.link,
        author: row.author,
        updateTime: row.update_time,
        rssId: row.rss_id
      };

      return {
        success: true,
        msg: '',
        data: contentInfo
      };
    } catch (error) {
      console.error('queryPostContentByGuid error:', error);
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
        data: "" as any
      };
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 检查RSS是否存在
   */
  async checkRssExists(urlOrId: string): Promise<{success: boolean, data: {exists: boolean}}> {
    try {
      const row = await this.dbHelper.get<{count: number}>(
        'SELECT COUNT(*) as count FROM rss_info WHERE feed_url = ? OR rss_id = ?',
        [urlOrId, urlOrId]
      );

      return {
        success: true,
        data: {
          exists: (row?.count || 0) > 0
        }
      };
    } catch (error) {
      return {
        success: false,
        data: { exists: false }
      };
    }
  }

  /**
   * 获取所有RSS信息列表
   */
  async getRssInfoListFromDb(): Promise<any[]> {
    try {
      return await this.dbHelper.all(
        'SELECT * FROM rss_info ORDER BY title'
      );
    } catch (error) {
      console.error('getRssInfoListFromDb error:', error);
      return [];
    }
  }

  /**
   * 标记文章为已读/未读
   */
  async markPostAsRead(guid: string, read: boolean): Promise<void> {
    await this.dbHelper.run(
      'UPDATE post_info SET read = ? WHERE guid = ?',
      [read ? 1 : 0, guid]
    );
  }

  /**
   * 添加收藏
   */
  async addFavoritePost(guid: string): Promise<void> {
    await this.dbHelper.run(
      'UPDATE post_info SET favorite = 1 WHERE guid = ?',
      [guid]
    );
  }

  /**
   * 移除收藏
   */
  async removeFavoritePost(guid: string): Promise<void> {
    await this.dbHelper.run(
      'UPDATE post_info SET favorite = 0 WHERE guid = ?',
      [guid]
    );
  }

  /**
   * 获取收藏列表
   */
  async queryFavoritePostList(): Promise<ErrorData<any>> {
    try {
      const rows = await this.dbHelper.all(
        'SELECT * FROM post_info WHERE favorite = 1 ORDER BY update_time DESC'
      );

      return {
        success: true,
        msg: '',
        data: rows
      };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
        data: []
      };
    }
  }

  /**
   * 清空所有收藏
   */
  async clearAllFavorites(): Promise<void> {
    await this.dbHelper.run(
      'UPDATE post_info SET favorite = 0 WHERE favorite = 1'
    );
  }
}
