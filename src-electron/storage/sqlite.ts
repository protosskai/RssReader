import {PostIndexItem, StorageUtil} from "app/src-electron/storage/common";
import {RssFolderItem} from "src/common/RssInfoItem";
import {ErrorData, ErrorMsg} from "src/common/ErrorMsg";
import {PostInfoItem} from "src/common/PostInfoItem";
import {extractTextFromHtml, beautyStr, convertStringToBase64, parseBase64ToString} from 'src-electron/util/string'
import {ContentInfo} from "src/common/ContentInfo";
import { SqliteHelper } from './SqliteHelper';

export class SqliteUtil implements StorageUtil {
  private dbHelper: SqliteHelper;
  private static instance: SqliteUtil | null = null;

  static getInstance(): SqliteUtil {
    if (SqliteUtil.instance === null) {
      SqliteUtil.instance = new SqliteUtil();
    }
    return SqliteUtil.instance;
  }

  private constructor() {
    this.dbHelper = SqliteHelper.getInstance();
  }

  async init() {
    await this.dbHelper.init();

    // 配置SQLite性能优化参数
    await this.configurePerformancePragmas()
  }

  private async checkTableExist(tableName: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.db?.all(`SELECT name FROM sqlite_master where name='${tableName}';`, (err, rows) => {
        if (err) {
          reject(err)
        }
        if (rows.length > 0) {
          resolve(true)
        } else {
          resolve(false)
        }
      })
    })
  }

  /**
   * 配置SQLite性能优化参数
   * 包括：同步模式、缓存大小、内存映射等
   */
  private async configurePerformancePragmas() {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [sqlite.ts] Configuring SQLite performance pragmas...`)

    try {
      // 启用WAL模式（Write-Ahead Logging）以提高并发性能
      // WAL模式可以显著提高读操作性能，并允许多个读取器并发访问
      this.db?.exec(`PRAGMA journal_mode = WAL`)

      // 设置同步模式为NORMAL，平衡性能和安全性
      // FULL: 最安全但最慢，NORMAL: 平衡二者，OFF: 最快但可能丢失数据
      this.db?.exec(`PRAGMA synchronous = NORMAL`)

      // 设置缓存大小为10MB（负值表示KB单位，正值表示页面数）
      // 更大的缓存可以减少磁盘I/O，提高性能
      this.db?.exec(`PRAGMA cache_size = -10240`)

      // 启用外键约束检查
      this.db?.exec(`PRAGMA foreign_keys = ON`)

      // 设置临时存储使用内存而不是磁盘
      // 可以提高需要临时表的复杂查询的性能
      this.db?.exec(`PRAGMA temp_store = MEMORY`)

      // 设置内存映射大小为256MB
      // 允许SQLite将数据库文件映射到内存中，进一步减少I/O
      this.db?.exec(`PRAGMA mmap_size = 268435456`)

      // 设置页面大小为4096字节（默认也是4096）
      // 较大的页面可以减少读取次数，提高性能
      this.db?.exec(`PRAGMA page_size = 4096`)

      console.log(`[${timestamp}] [sqlite.ts] SQLite performance pragmas configured successfully`)
    } catch (error) {
      console.error(`[${timestamp}] [sqlite.ts] Failed to configure pragmas:`, error)
      // PRAGMA配置失败不影响主功能，但需要记录日志
    }
  }

  private async createTable() {
    if (!await this.checkTableExist('folder_info')) {
      this.db?.exec(`
        CREATE TABLE folder_info(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            parent_id INTEGER NULL
        )
    `)
    }
    if (!await this.checkTableExist('rss_info')) {
      this.db?.exec(`
        CREATE TABLE rss_info(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rss_id VARCHAR(255) NOT NULL,
            folder_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            html_url VARCHAR(255) NOT NULL,
            feed_url VARCHAR(255) NOT NULL,
            avatar VARCHAR(255) NOT NULL,
            update_time DATETIME NULL
        )
    `)
    }
    if (!await this.checkTableExist('post_info')) {
      this.db?.exec(`
         CREATE TABLE post_info(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rss_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            author VARCHAR(255) NOT NULL,
            link VARCHAR(255) NOT NULL,
            content BLOB NOT NULL,
            guid VARCHAR(255) NOT NULL,
            read INTEGER NOT NULL,
            update_time DATETIME NOT NULL
        )
      `)
    }

    // 创建全文搜索FTS5表
    await this.createFtsTable()

    // 创建数据库索引以优化查询性能
    await this.createIndexes()
  }

  private async createFtsTable() {
    // 检查是否已存在FTS表
    if (!await this.checkTableExist('post_info_fts')) {
      // 创建FTS5虚拟表
      this.db?.exec(`
        CREATE VIRTUAL TABLE post_info_fts USING fts5(
          title,
          content,
          author,
          rss_id,
          update_time,
          content='post_info',
          content_rowid='id',
          tokenize='porter'
        )
      `)

      // 创建触发器同步数据
      this.db?.exec(`
        CREATE TRIGGER post_info_ai AFTER INSERT ON post_info BEGIN
          INSERT INTO post_info_fts(rowid, title, content, author, rss_id, update_time)
          VALUES (new.id, new.title, new.content, new.author, new.rss_id, new.update_time);
        END;
      `)

      this.db?.exec(`
        CREATE TRIGGER post_info_ad AFTER DELETE ON post_info BEGIN
          INSERT INTO post_info_fts(post_info_fts, rowid, title, content, author, rss_id, update_time)
          VALUES ('delete', old.id, old.title, old.content, old.author, old.rss_id, old.update_time);
        END;
      `)

      this.db?.exec(`
        CREATE TRIGGER post_info_au AFTER UPDATE ON post_info BEGIN
          INSERT INTO post_info_fts(post_info_fts, rowid, title, content, author, rss_id, update_time)
          VALUES ('delete', old.id, old.title, old.content, old.author, old.rss_id, old.update_time);
          INSERT INTO post_info_fts(rowid, title, content, author, rss_id, update_time)
          VALUES (new.id, new.title, new.content, new.author, new.rss_id, new.update_time);
        END;
      `)
    }
  }

  /**
   * 确保FTS表存在（如果不存在则创建）
   */
  private async ensureFtsTable(): Promise<void> {
    if (!await this.checkTableExist('post_info_fts')) {
      console.log('[sqlite.ts] FTS table not found, creating it...')
      await this.createFtsTable()
      console.log('[sqlite.ts] FTS table created successfully')
    }
  }

  /**
   * 创建数据库索引以优化查询性能
   * 包括：rss_id、folder_id、guid、update_time等常用查询字段的索引
   */
  private async createIndexes() {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [sqlite.ts] Creating database indexes for performance optimization...`)

    try {
      // 为rss_info表创建索引
      // RSS ID索引 - 用于快速查找特定RSS源
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_rss_info_rss_id ON rss_info(rss_id)`)

      // 文件夹ID索引 - 用于按文件夹过滤RSS源
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_rss_info_folder_id ON rss_info(folder_id)`)

      // RSS更新时间的索引 - 用于按时间排序
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_rss_info_update_time ON rss_info(update_time)`)

      // 为post_info表创建索引
      // RSS ID索引 - 用于快速查找特定RSS源的文章列表
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_post_info_rss_id ON post_info(rss_id)`)

      // GUID索引 - 用于快速查找特定文章内容
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_post_info_guid ON post_info(guid)`)

      // 文章更新时间的复合索引 - 用于按时间排序文章列表
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_post_info_rss_id_update_time ON post_info(rss_id, update_time DESC)`)

      // 已读状态索引 - 用于快速筛选未读文章
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_post_info_read ON post_info(read)`)

      // 作者索引 - 用于按作者搜索文章
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_post_info_author ON post_info(author)`)

      // 为folder_info表创建索引
      // 文件夹名称索引 - 用于快速查找文件夹
      this.db?.exec(`CREATE INDEX IF NOT EXISTS idx_folder_info_name ON folder_info(name)`)

      console.log(`[${timestamp}] [sqlite.ts] Database indexes created successfully`)
    } catch (error) {
      console.error(`[${timestamp}] [sqlite.ts] Failed to create indexes:`, error)
      // 索引创建失败不影响主功能，但需要记录日志
      throw error
    }
  }

  /**
   * 向folder_info表插入一条记录
   * @param folderName
   * @param parentId
   */
  async insertFolderInfo(folderName: string, parentId?: string): Promise<ErrorMsg> {
    let sql: string | null = null
    if (parentId) {
      sql = `insert into folder_info (name, parentId) values ("${folderName}, ${parentId}")`
    } else {
      sql = `insert into folder_info (name) values ("${folderName}")`
    }
    return new Promise((resolve) => {
      this.db?.run(sql!, (err) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message
          })
        } else {
          resolve({
            success: true,
            msg: ''
          })
        }
      })
    })
  }

  /**
   * 向rss_info表插入一条记录
   * @param rssId
   * @param folderId
   * @param title
   * @param htmlUrl
   * @param feedUrl
   * @param avatar
   * @param updateTime
   */
  async insertRssInfo(rssId: string, folderId: number,
                      title: string, htmlUrl: string,
                      feedUrl: string, avatar: string,
                      updateTime: string): Promise<ErrorMsg> {
    const sql = `insert into rss_info (rss_id,folder_id,title,html_url,feed_url,avatar,update_time)
                              values("${rssId}", ${folderId}, "${title}", "${htmlUrl}", "${feedUrl}",
                              "${avatar}", "${updateTime}")`
    return new Promise((resolve) => {
      this.db?.run(sql!, (err) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message
          })
        } else {
          resolve({
            success: true,
            msg: ''
          })
        }
      })
    })
  }

  async insertPostInfo(rssId: string, title: string, author: string, link: string,
                       content: string, guid: string, updateTime: string): Promise<ErrorMsg> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [sqlite.ts] insertPostInfo called`);
    console.log(`[${timestamp}] [sqlite.ts] rssId:`, rssId);
    console.log(`[${timestamp}] [sqlite.ts] title:`, title);
    console.log(`[${timestamp}] [sqlite.ts] guid:`, guid);

    const sql = `insert into post_info (rss_id, title, author, link, content, guid, update_time, read)
                    values(?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [rssId, title, author, link, convertStringToBase64(content), guid, updateTime, 0];

    try {
      console.log(`[${timestamp}] [sqlite.ts] Executing INSERT...`);
      await this.dbHelper.run(sql, params);
      console.log(`[${timestamp}] [sqlite.ts] INSERT successful`);
      return {
        success: true,
        msg: ''
      };
    } catch (err: any) {
      console.error(`[${timestamp}] [sqlite.ts] INSERT failed:`, err);
      console.error(`[${timestamp}] [sqlite.ts] Error stack:`, err.stack);
      return {
        success: false,
        msg: err.message
      };
    }
  }

  /**
   * 通过rssId更新rss_info的内容
   * @param rssId
   * @param folderId
   * @param title
   * @param htmlUrl
   * @param feedUrl
   * @param avatar
   * @param updateTime
   */
  async updateRssInfo(rssId: string, folderId: number,
                      title: string, htmlUrl: string,
                      feedUrl: string, avatar: string,
                      updateTime: string): Promise<ErrorMsg> {
    const sql = `update rss_info set folder_id=${folderId}, title="${title}", html_url="${htmlUrl}",
                feed_url="${feedUrl}", avatar="${avatar}", update_time="${updateTime}"
                where rss_id="${rssId}"`
    return new Promise((resolve) => {
      this.db?.run(sql!, (err) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message
          })
        } else {
          resolve({
            success: true,
            msg: ''
          })
        }
      })
    })
  }

  async updatePostInfo(postId: number, rssId: string, title: string, author: string, link: string,
                       content: string, updateTime: string, read: boolean): Promise<ErrorMsg> {
    const sql = `update post_info set rss_id="${rssId}", title="${title}", author="${author}",link="${link}",
                    content=$content, update_time="${updateTime}", read=$read`
    return new Promise((resolve) => {
      this.db?.run(sql!, {
        $content: convertStringToBase64(content),
        $read: read ? 1 : 0
      }, (err) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message
          })
        } else {
          resolve({
            success: true,
            msg: ''
          })
        }
      })
    })
  }

  /**
   * 通过目录名称查询folder_info表,不传入参数则返回所有folder_info
   * @param folderName
   */
  async queryFolderByFolderId(folderId?: number): Promise<ErrorData<any>> {
    let sql: string | null
    if (folderId) {
      sql = `select * from folder_info where id=${folderId}`
    } else {
      sql = `select * from folder_info`
    }
    return new Promise<ErrorData<any>>((resolve) => {
      this.db?.all(sql!, (err, rows) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message,
            data: []
          })
        }
        resolve({
          success: true,
          msg: '',
          data: rows
        })
      })
    })
  }

  async queryFolderByFolderName(folderName?: string): Promise<ErrorData<any>> {
    let sql: string | null
    if (folderName) {
      sql = `select * from folder_info where name="${folderName}"`
    } else {
      sql = `select * from folder_info`
    }
    return new Promise<ErrorData<any>>((resolve) => {
      this.db?.all(sql!, (err, rows) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message,
            data: []
          })
        }
        resolve({
          success: true,
          msg: '',
          data: rows
        })
      })
    })
  }

  /**
   * 通过订阅链接查询rss_info表,不传入参数则返回所有rss_info
   * @param feedUrl
   */
  async queryRssByRssId(rssId?: string): Promise<ErrorData<any>> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [sqlite.ts] queryRssByRssId called`);
    console.log(`[${timestamp}] [sqlite.ts] rssId:`, rssId);

    let sql: string | null
    if (rssId) {
      sql = `select * from rss_info where rss_id=?`;
    } else {
      sql = `select * from rss_info`;
    }

    try {
      console.log(`[${timestamp}] [sqlite.ts] Executing query...`);
      console.log(`[${timestamp}] [sqlite.ts] SQL:`, sql);
      console.log(`[${timestamp}] [sqlite.ts] Parameters:`, rssId ? [rssId] : []);

      const rows = await this.dbHelper.all<any>(sql, rssId ? [rssId] : []);
      console.log(`[${timestamp}] [sqlite.ts] Query result rows:`, rows.length);

      return {
        success: true,
        msg: '',
        data: rows
      };
    } catch (err: any) {
      console.error(`[${timestamp}] [sqlite.ts] Query failed:`, err);
      console.error(`[${timestamp}] [sqlite.ts] Error stack:`, err.stack);
      return {
        success: false,
        msg: err.message,
        data: []
      };
    }
  }

  async queryPostIndexByRssId(rssId: string): Promise<ErrorData<PostIndexItem[]>> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [sqlite.ts] queryPostIndexByRssId called`);
    console.log(`[${timestamp}] [sqlite.ts] rssId:`, rssId);

    try {
      const sql = `SELECT title, guid, link, content, author, update_time, read FROM post_info WHERE rss_id = ? ORDER BY update_time DESC`;
      console.log(`[${timestamp}] [sqlite.ts] Executing SQL:`, sql);
      console.log(`[${timestamp}] [sqlite.ts] Query parameter:`, rssId);

      const rows = await this.dbHelper.all<any>(sql, [rssId]);
      console.log(`[${timestamp}] [sqlite.ts] Query result rows:`, rows);
      console.log(`[${timestamp}] [sqlite.ts] Row count:`, rows.length);

      const result: PostIndexItem[] = [];
      for (const row of rows) {
        let desc: string = parseBase64ToString(row.content);
        desc = beautyStr(extractTextFromHtml(desc), 100);
        result.push({
          title: row.title,
          guid: row.guid,
          link: row.link,
          author: row.author,
          updateTime: row.update_time,
          read: row.read === 1,
          desc
        });
      }

      console.log(`[${timestamp}] [sqlite.ts] Processed ${result.length} articles`);
      console.log(`[${timestamp}] [sqlite.ts] queryPostIndexByRssId completed successfully`);

      return {
        success: true,
        msg: '',
        data: result
      };
    } catch (error) {
      console.error(`[${timestamp}] [sqlite.ts] queryPostIndexByRssId ERROR:`, error);
      console.error(`[${timestamp}] [sqlite.ts] Error stack:`, error.stack);

      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
        data: []
      };
    }
  }

  async queryPostContentByGuid(guid: string): Promise<ErrorData<ContentInfo>> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [sqlite.ts] queryPostContentByGuid called with guid:`, guid);

    try {
      // 首先尝试通过guid查询
      const sql = `select rss_id,title,content,link,author,update_time from post_info where guid = ?`;
      console.log(`[${timestamp}] [sqlite.ts] Executing query by guid:`, sql, 'params:', [guid]);
      let rows = await this.dbHelper.all<any>(sql, [guid]);
      console.log(`[${timestamp}] [sqlite.ts] Query by guid result:`, rows.length, 'rows');

      // 如果没有结果，尝试通过link查询（降级处理）
      if (rows.length === 0) {
        console.log(`[${timestamp}] [sqlite.ts] No results by guid, trying fallback query by link...`);
        const fallbackSql = `select rss_id,title,content,link,author,update_time from post_info where link = ?`;
        console.log(`[${timestamp}] [sqlite.ts] Executing fallback query:`, fallbackSql, 'params:', [guid]);
        rows = await this.dbHelper.all<any>(fallbackSql, [guid]);
        console.log(`[${timestamp}] [sqlite.ts] Fallback query result:`, rows.length, 'rows');
      }

      if (rows.length === 0) {
        console.warn(`[${timestamp}] [sqlite.ts] No data found for guid/link:`, guid);
        return {
          success: false,
          msg: `guid/link【${guid}】不存在!`,
          data: {} as ContentInfo
        };
      }

      const [row] = rows;
      console.log(`[${timestamp}] [sqlite.ts] Processing row data:`, row);

      const contentInfo: ContentInfo = {
        title: row["title"],
        content: parseBase64ToString(row.content),
        link: row["link"],
        author: row["author"],
        updateTime: row["update_time"],
        rssId: row["rss_id"]
      };

      console.log(`[${timestamp}] [sqlite.ts] Created contentInfo:`, contentInfo);
      console.log(`[${timestamp}] [sqlite.ts] queryPostContentByGuid completed successfully`);

      return {
        success: true,
        msg: '',
        data: contentInfo
      };
    } catch (error) {
      console.error(`[${timestamp}] [sqlite.ts] queryPostContentByGuid ERROR:`, error);
      console.error(`[${timestamp}] [sqlite.ts] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
        data: {} as ContentInfo
      };
    }
  }

  async cleanFolderInfoTable(): Promise<ErrorMsg> {
    const sql = `delete from folder_info;`
    return new Promise((resolve) => {
      this.db?.run(sql, (err) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message
          })
        }
        resolve({
          success: true,
          msg: ''
        })
      })
    })
  }

  async cleanRssInfoTable(): Promise<ErrorMsg> {
    const sql = `delete from rss_info;`
    return new Promise((resolve) => {
      this.db?.run(sql, (err) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message
          })
        }
        resolve({
          success: true,
          msg: ''
        })
      })
    })
  }

  async deleteRssInfoByFolderName(folderName: string): Promise<ErrorMsg> {
    if (!await this.checkFolderExist(folderName)) {
      return {
        success: false,
        msg: `${folderName}不存在!`
      }
    }
    const folderInfo = (await this.queryFolderByFolderName(folderName)).data[0]
    let sql: string = `delete from rss_info where folder_id=${folderInfo.id}`
    return new Promise((resolve) => {
      this.db?.run(sql, (err) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message
          })
        }
        resolve({
          success: true,
          msg: ''
        })
      })
    })
  }

  async deleteFolderInfo(folderName: string): Promise<ErrorMsg> {
    const sql = `delete from folder_info where name='${folderName}';`
    return new Promise((resolve) => {
      this.db?.run(sql, (err) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message
          })
        }
        resolve({
          success: true,
          msg: ''
        })
      })
    })
  }

  async checkFolderExist(folderName: string): Promise<boolean> {
    const folderData = await this.queryFolderByFolderName(folderName)
    if (!folderData.success) {
      throw new Error(folderData.msg)
    }
    return folderData.data.length > 0;
  }

  async checkRssExist(rssId: string): Promise<boolean> {
    const rssData = await this.queryRssByRssId(rssId)
    if (!rssData.success) {
      throw new Error(rssData.msg)
    }
    return rssData.data.length > 0;
  }

  /**
   * 将folder信息同步到数据库表中,同时同步folder关联的rss信息
   * @param folderInfo
   */
  async syncFolderInfo(folderInfo: RssFolderItem) {
    if (!await this.checkFolderExist(folderInfo.folderName)) {
      const result = await this.insertFolderInfo(folderInfo.folderName)
      if (!result.success) {
        throw new Error(result.msg)
      }
    }
    const [folderData] = (await this.queryFolderByFolderName(folderInfo.folderName)).data
    const folderId = folderData["id"] as number
    for (const rssInfo of folderInfo.data) {
      if (!await this.checkRssExist(rssInfo.id)) {
        const result = await this.insertRssInfo(rssInfo.id, folderId, rssInfo.title, rssInfo.htmlUrl,
          rssInfo.feedUrl, rssInfo.avatar ? rssInfo.avatar : "",
          rssInfo.lastUpdateTime ? rssInfo.lastUpdateTime : "")
        if (!result.success) {
          throw new Error(result.msg)
        }
      }
      const [rssData] = (await this.queryRssByRssId(rssInfo.id)).data
      const result = await this.updateRssInfo(rssData.rss_id, folderId, rssInfo.title, rssInfo.htmlUrl,
        rssInfo.feedUrl, rssInfo.avatar ? rssInfo.avatar : "",
        rssInfo.lastUpdateTime ? rssInfo.lastUpdateTime : "")
      if (!result.success) {
        throw new Error(result.msg)
      }
    }
  }


  async dumpFolderItemList(folderInfoList: RssFolderItem[]): Promise<ErrorMsg> {
    for (const folderItem of folderInfoList) {
      await this.syncFolderInfo(folderItem)
    }
    // 开始清理多余的folder和rss
    const allFolderInfo = (await this.queryFolderByFolderName()).data
    const folderNameList = folderInfoList.map(item => item.folderName)
    for (const folderInfo of allFolderInfo) {
      if (!folderNameList.includes(folderInfo.name)) {
        // folder关联的rss信息也要一起删除
        await this.deleteRssInfoByFolderName(folderInfo.name)
        // 不存在的folder要从db中删除
        await this.deleteFolderInfo(folderInfo.name)
      }
    }
    return {
      success: true,
      msg: ''
    }
  }

  async loadFolderItemList(): Promise<ErrorData<RssFolderItem[]>> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [sqlite.ts] SqliteUtil.loadFolderItemList called`);

    try {
      // 使用新的dbHelper查询数据
      console.log(`[${timestamp}] [sqlite.ts] Querying folders from database...`);
      const folderData = await this.dbHelper.all<any>('SELECT * FROM folder_info ORDER BY name');
      console.log(`[${timestamp}] [sqlite.ts] Folder query result:`, folderData);

      console.log(`[${timestamp}] [sqlite.ts] Querying RSS sources from database...`);
      const rssData = await this.dbHelper.all<any>('SELECT * FROM rss_info');
      console.log(`[${timestamp}] [sqlite.ts] RSS query result:`, rssData);

      console.log(`[${timestamp}] [sqlite.ts] Processing data...`);
      const folderInfoList: RssFolderItem[] = [];

      for (const item of folderData) {
        const folderName = item.name;
        const folderId = item.id;
        const folderInfo: RssFolderItem = {
          folderName,
          data: [],
          children: []
        };

        for (const item1 of rssData) {
          const rssId = item1.rss_id;
          const rssFolderId = item1.folder_id;
          if (rssFolderId === folderId) {
            folderInfo.data.push({
              id: rssId,
              title: item1.title,
              unread: 0,
              htmlUrl: item1.html_url,
              feedUrl: item1.feed_url,
              avatar: item1.avatar,
              lastUpdateTime: item1.update_time
            });
          }
        }

        folderInfoList.push(folderInfo);
      }

      console.log(`[${timestamp}] [sqlite.ts] loadFolderItemList completed, returning ${folderInfoList.length} folders`);

      return {
        success: true,
        msg: '',
        data: folderInfoList
      };
    } catch (error) {
      console.error(`[${timestamp}] [sqlite.ts] loadFolderItemList ERROR:`, error);
      console.error(`[${timestamp}] [sqlite.ts] Error stack:`, error.stack);

      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
        data: []
      };
    }
  }

  async checkPostInfoExist(guid: string): Promise<boolean> {
    const sql = `SELECT * FROM post_info where guid="${guid}";`
    return new Promise<boolean>((resolve, reject) => {
      this.db?.all(sql, (err, rows) => {
        if (err) {
          reject(err)
        }
        if (rows.length > 0) {
          resolve(true)
        } else {
          resolve(false)
        }
      })
    })
  }

  async syncRssPostList(rssId: string, postInfoItemList: PostInfoItem[]): Promise<ErrorMsg> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [sqlite.ts] syncRssPostList called`);
    console.log(`[${timestamp}] [sqlite.ts] rssId:`, rssId);
    console.log(`[${timestamp}] [sqlite.ts] postInfoItemList count:`, postInfoItemList.length);

    const rssInfoResult = await this.queryRssByRssId(rssId)
    if (!rssInfoResult.success) {
      throw new Error(rssInfoResult.msg)
    }

    try {
      console.log(`[${timestamp}] [sqlite.ts] Getting existing article guids...`);
      // 获取现有文章的guid列表，用于增量更新判断
      const existingRows = await this.dbHelper.all<{guid: string}>(`SELECT guid FROM post_info WHERE rss_id = ?`, [rssId]);
      const existingGuids = existingRows.map(row => row.guid);
      console.log(`[${timestamp}] [sqlite.ts] Existing guids count:`, existingGuids.length);

      // 使用Set提高查找效率
      const existingGuidSet = new Set(existingGuids)
      let newArticleCount = 0
      console.log(`[${timestamp}] [sqlite.ts] Processing ${postInfoItemList.length} articles...`);

      // 只插入新的文章（guid不存在于现有列表中）
      for (let i = 0; i < postInfoItemList.length; i++) {
        const item = postInfoItemList[i];
        // 检查是否已存在相同guid的文章
        if (!existingGuidSet.has(item.guid)) {
          console.log(`[${timestamp}] [sqlite.ts] Inserting new article: ${item.title}`);
          const result = await this.insertPostInfo(rssId, item.title, item.author, item.link, item.desc, item.guid, item.updateTime)
          if (!result.success) {
            console.error(`[${timestamp}] [sqlite.ts] Insert failed: ${result.msg}`)
            // 继续处理其他文章，不中断整个同步过程
            continue
          }
          newArticleCount++
        } else {
          console.log(`[${timestamp}] [sqlite.ts] Article already exists, skipping: ${item.title}`);
        }
      }

      console.log(`[${timestamp}] [sqlite.ts] Sync completed: RSS源 ${rssId} 添加了 ${newArticleCount} 篇新文章`);
      return {
        success: true,
        msg: ''
      };
    } catch (error) {
      console.error(`[${timestamp}] [sqlite.ts] Sync failed:`, error);
      console.error(`[${timestamp}] [sqlite.ts] Error stack:`, error.stack);
      // 重新抛出错误，让上层处理
      throw error;
    }
  }

  /**
   * 全文搜索文章
   * @param query 搜索关键词
   * @param options 搜索选项
   */
  async searchPosts(query: string, options?: {
    folderId?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
  }): Promise<ErrorData<PostIndexItem[]>> {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [sqlite.ts] searchPosts called with query:`, query)

    try {
      // 检查并创建FTS表（如果不存在）
      await this.ensureFtsTable()

      const { folderId, dateFrom, dateTo, limit = 100 } = options || {}

      // 构建FTS查询
      let sql = `
        SELECT
          p.rowid,
          p.title,
          p.author,
          p.link,
          p.guid,
          p.content,
          p.update_time,
          p.read,
          r.title as rss_title,
          r.avatar as rss_avatar,
          f.name as folder_name,
          f.id as folder_id
        FROM post_info_fts fts
        JOIN post_info p ON fts.rowid = p.id
        JOIN rss_info r ON p.rss_id = r.rss_id
        JOIN folder_info f ON r.folder_id = f.id
        WHERE fts MATCH ?
      `
      const params: any[] = [query]

      // 添加文件夹过滤
      if (folderId) {
        sql += ` AND r.folder_id = ?`
        params.push(folderId)
      }

      // 添加日期过滤
      if (dateFrom) {
        sql += ` AND p.update_time >= ?`
        params.push(dateFrom)
      }

      if (dateTo) {
        sql += ` AND p.update_time <= ?`
        params.push(dateTo)
      }

      // 排序和限制
      sql += ` ORDER BY p.update_time DESC LIMIT ?`
      params.push(limit)

      console.log(`[${timestamp}] [sqlite.ts] Executing search SQL:`, sql)
      console.log(`[${timestamp}] [sqlite.ts] Search params:`, params)

      const rows = await this.dbHelper.all<any>(sql, params)
      console.log(`[${timestamp}] [sqlite.ts] Search result count:`, rows.length)

      // 处理结果，转换格式
      const result: PostIndexItem[] = rows.map(row => {
        let desc: string = parseBase64ToString(row.content)
        desc = beautyStr(extractTextFromHtml(desc), 100)
        return {
          title: row.title,
          guid: row.guid,
          link: row.link,
          author: row.author,
          updateTime: row.update_time,
          read: row.read === 1,
          desc,
          rssId: row.rss_id
        }
      })

      console.log(`[${timestamp}] [sqlite.ts] searchPosts completed successfully`)

      return {
        success: true,
        msg: '',
        data: result
      }
    } catch (error) {
      console.error(`[${timestamp}] [sqlite.ts] searchPosts ERROR:`, error)
      console.error(`[${timestamp}] [sqlite.ts] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')

      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
        data: []
      }
    }
  }
}
