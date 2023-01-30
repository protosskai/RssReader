import sqlite3 from "sqlite3"
import {StorageUtil} from "app/src-electron/storage/common";
import {RssFolderItem} from "src/common/RssInfoItem";
import {ErrorData, ErrorMsg} from "src/common/ErrorMsg";

const DB_FILE_PATH = './sqlite.db'

export class SqliteUtil implements StorageUtil {
  private db: sqlite3.Database | null = null
  private static instance: SqliteUtil | null = null

  static getInstance(): SqliteUtil {
    if (SqliteUtil.instance === null) {
      SqliteUtil.instance = new SqliteUtil()
    }
    return SqliteUtil.instance
  }

  async init() {
    this.db = new sqlite3.Database(DB_FILE_PATH, (error) => {
      if (error) {
        throw error
      }
    })
    console.log("Connection with SQLite has been established");
    await this.createTable()
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
            folder_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            html_url VARCHAR(255) NOT NULL,
            feed_url VARCHAR(255) NOT NULL,
            avatar VARCHAR(255) NOT NULL,
            update_time DATETIME NULL
        )
    `)
    }
  }

  /**
   * 向folder_info表插入一条记录
   * @param folderName
   * @param parentId
   */
  async insertFolderInfo(folderName: string, parentId?: string): Promise<ErrorMsg> {
    return {
      success: true,
      msg: ''
    }
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
  async insertRssInfo(rssId: number, folderId: number,
                      title: string, htmlUrl: string,
                      feedUrl: string, avatar: string,
                      updateTime: string): Promise<ErrorMsg> {
    return {
      success: true,
      msg: ''
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
  async updateRssInfo(rssId: number, folderId: number,
                      title: string, htmlUrl: string,
                      feedUrl: string, avatar: string,
                      updateTime: string): Promise<ErrorMsg> {
    return {
      success: true,
      msg: ''
    }
  }

  /**
   * 通过目录名称查询folder_info表,不传入参数则返回所有folder_info
   * @param folderName
   */
  async queryFolderByFolderId(folderId?: string): Promise<ErrorData<any>> {
    return {
      success: true,
      msg: '',
      data: []
    }
  }

  /**
   * 通过订阅链接查询rss_info表,不传入参数则返回所有rss_info
   * @param feedUrl
   */
  async queryRssByRssId(rssId?: number): Promise<ErrorData<any>> {
    return {
      success: true,
      msg: '',
      data: []
    }
  }

  /**
   * 将folder信息同步到数据库表中,同时同步folder关联的rss信息
   * @param folderInfo
   */
  async syncFolderInfo(folderInfo: RssFolderItem) {

  }


  async dumpFolderItemList(folderInfoList: RssFolderItem[]): Promise<ErrorMsg> {
    return {
      success: true,
      msg: ''
    }
  }

  async loadFolderItemList(): Promise<ErrorData<RssFolderItem[]>> {
    return {
      success: true,
      msg: '',
      data: []
    }
  }
}
