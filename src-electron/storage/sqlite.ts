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
    let sql: string | null
    if (rssId) {
      sql = `select * from rss_info where rss_id="${rssId}"`
    } else {
      sql = `select * from rss_info`
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
    return {
      success: true,
      msg: '',
      data: []
    }
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
      const result = await this.updateRssInfo(rssData.id, folderId, rssInfo.title, rssInfo.htmlUrl,
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
