import sqlite3 from "sqlite3"
import {PostIndexItem, StorageUtil} from "app/src-electron/storage/common";
import {RssFolderItem} from "src/common/RssInfoItem";
import {ErrorData, ErrorMsg} from "src/common/ErrorMsg";
import {PostInfoItem} from "src/common/PostInfoItem";
import {extractTextFromHtml, beautyStr, convertStringToBase64, parseBase64ToString} from 'src-electron/util/string'
import {ContentInfo} from "src/common/ContentInfo";
import getAppDataPath from "appdata-path";

const DB_FILE_PATH = `${getAppDataPath()}/sqlite.db`

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
  }

  /**
   * ???folder_info?????????????????????
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
   * ???rss_info?????????????????????
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
    const sql = `insert into post_info (rss_id, title, author, link, content, guid, update_time, read)
                    values("${rssId}", "${title}", "${author}", "${link}", $content, "${guid}", "${updateTime}", 0)`
    return new Promise((resolve) => {
      this.db?.run(sql!, {
        $content: convertStringToBase64(content)
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
   * ??????rssId??????rss_info?????????
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
   * ????????????????????????folder_info???,??????????????????????????????folder_info
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
   * ????????????????????????rss_info???,??????????????????????????????rss_info
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
  }

  async queryPostIndexByRssId(rssId: string): Promise<ErrorData<PostIndexItem[]>> {
    const sql = `select title, guid, content,author, update_time, read from post_info where rss_id="${rssId}"`
    return new Promise<ErrorData<any>>((resolve) => {
      this.db?.all(sql!, (err, rows) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message,
            data: []
          })
        }
        const result: PostIndexItem[] = [];
        for (const row of rows) {
          let desc: string = parseBase64ToString(row['content'])
          desc = beautyStr(extractTextFromHtml(desc), 100)
          result.push({
            title: row['title'],
            guid: row['guid'],
            author: row['author'],
            updateTime: row['update_time'],
            read: row['read'] === 1,
            desc
          })
        }
        resolve({
          success: true,
          msg: '',
          data: result
        })
      })
    })
  }

  async queryPostContentByGuid(guid: string): Promise<ErrorData<ContentInfo>> {
    const sql = `select rss_id,title,content,link,author,update_time from post_info where guid="${guid}"`
    return new Promise<ErrorData<any>>((resolve) => {
      this.db?.all(sql!, (err, rows) => {
        if (err) {
          resolve({
            success: false,
            msg: err.message,
            data: []
          })
        }
        if (rows.length === 0) {
          resolve({
            success: false,
            msg: `guid???${guid}????????????!`,
            data: ""
          })
        } else {
          const [row] = rows;
          const contentInfo: ContentInfo = {
            title: row["title"],
            content: parseBase64ToString(row.content),
            link: row["link"],
            author: row["author"],
            updateTime: row["update_time"],
            rssId: row["rss_id"]
          }
          resolve({
            success: true,
            msg: ``,
            data: contentInfo
          })
        }
      })
    })
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
        msg: `${folderName}?????????!`
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
   * ???folder??????????????????????????????,????????????folder?????????rss??????
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
    // ?????????????????????folder???rss
    const allFolderInfo = (await this.queryFolderByFolderName()).data
    const folderNameList = folderInfoList.map(item => item.folderName)
    for (const folderInfo of allFolderInfo) {
      if (!folderNameList.includes(folderInfo.name)) {
        // folder?????????rss????????????????????????
        await this.deleteRssInfoByFolderName(folderInfo.name)
        // ????????????folder??????db?????????
        await this.deleteFolderInfo(folderInfo.name)
      }
    }
    return {
      success: true,
      msg: ''
    }
  }

  async loadFolderItemList(): Promise<ErrorData<RssFolderItem[]>> {
    const folderData = await this.queryFolderByFolderId()
    const rssData = await this.queryRssByRssId()
    const folderInfoList: RssFolderItem[] = []
    folderData.data.forEach((item: any) => {
      const folderName = item.name
      const folderId = item.id
      const folderInfo: RssFolderItem = {
        folderName,
        data: [],
        children: []
      }
      rssData.data.forEach((item1: any) => {
        const rssId = item1.rss_id
        const rssFolderId = item1.folder_id
        if (rssFolderId === folderId) {
          folderInfo.data.push({
            id: rssId,
            title: item1.title,
            unread: 0,
            htmlUrl: item1.html_url,
            feedUrl: item1.feed_url,
            avatar: item1.avatar,
            lastUpdateTime: item1.update_time
          })
        }
      })
      folderInfoList.push(folderInfo)
    })
    return {
      success: true,
      msg: '',
      data: folderInfoList
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
    const rssInfoResult = await this.queryRssByRssId(rssId)
    if (!rssInfoResult.success) {
      throw new Error(rssInfoResult.msg)
    }
    const {data: rssData} = rssInfoResult
    for (const item of postInfoItemList) {
      if (!await this.checkPostInfoExist(item.guid)) {
        const result = await this.insertPostInfo(rssId, item.title, item.author, item.link, item.desc, item.guid, item.updateTime)
        if (!result.success) {
          throw new Error(result.msg)
        }
      }
    }
    return {
      success: true,
      msg: ''
    }
  }
}
