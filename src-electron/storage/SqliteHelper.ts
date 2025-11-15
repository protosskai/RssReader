/**
 * SQLite并发控制辅助类
 * 提供读写锁、操作队列和Promise化API
 */

import sqlite3, { Database } from 'sqlite3';
import getAppDataPath from 'appdata-path';

// 简化的锁实现
class ReadWriteLock {
  private writers: Array<() => void> = [];
  private readers: Array<() => void> = [];
  private activeReaders = 0;
  private activeWriter = false;

  async read(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.activeWriter && this.writers.length === 0) {
        this.activeReaders++;
        resolve(() => this.releaseRead());
      } else {
        this.readers.push(() => {
          this.activeReaders++;
          resolve(() => this.releaseRead());
        });
      }
    });
  }

  async write(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.activeWriter && this.activeReaders === 0) {
        this.activeWriter = true;
        resolve(() => this.releaseWrite());
      } else {
        this.writers.push(() => {
          this.activeWriter = true;
          resolve(() => this.releaseWrite());
        });
      }
    });
  }

  private releaseRead() {
    this.activeReaders--;
    if (this.activeReaders === 0 && this.writers.length > 0) {
      const releaseWriter = this.writers.shift()!;
      releaseWriter();
    }
  }

  private releaseWrite() {
    this.activeWriter = false;
    if (this.readers.length > 0) {
      const releaseReaders = this.readers.splice(0, this.readers.length);
      this.activeReaders = releaseReaders.length;
      releaseReaders.forEach(release => release());
    } else if (this.writers.length > 0) {
      const releaseWriter = this.writers.shift()!;
      releaseWriter();
    }
  }
}

// 操作队列
class OperationQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      const operation = this.queue.shift()!;
      try {
        await operation();
      } catch (error) {
        console.error('Queue operation failed:', error);
      }
    }

    this.processing = false;
  }
}

export class SqliteHelper {
  private db: Database | null = null;
  private lock = new ReadWriteLock();
  private queue = new OperationQueue();
  private static instance: SqliteHelper | null = null;
  private inTransaction = false;

  static getInstance(): SqliteHelper {
    if (SqliteHelper.instance === null) {
      SqliteHelper.instance = new SqliteHelper();
    }
    return SqliteHelper.instance;
  }

  async init(): Promise<void> {
    const dbPath = `${getAppDataPath()}/sqlite.db`;

    return new Promise((resolve, reject) => {
      this.db = new Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (error) => {
        if (error) {
          console.error('Error opening database:', error);
          reject(error);
          return;
        }

        console.log('Connection with SQLite has been established');

        // 启用外键约束
        this.db!.run('PRAGMA foreign_keys = ON');

        // 启用WAL模式以提高并发性能
        this.db!.run('PRAGMA journal_mode = WAL');

        // 设置超时
        this.db!.run('PRAGMA busy_timeout = 5000');

        // 创建表
        this.createTables().then(() => {
          resolve();
        }).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    const tables = [
      {
        name: 'folder_info',
        sql: `
          CREATE TABLE IF NOT EXISTS folder_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL UNIQUE,
            parent_id INTEGER NULL
          )
        `
      },
      {
        name: 'rss_info',
        sql: `
          CREATE TABLE IF NOT EXISTS rss_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rss_id VARCHAR(255) NOT NULL UNIQUE,
            folder_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            html_url VARCHAR(255) NOT NULL,
            feed_url VARCHAR(255) NOT NULL,
            avatar VARCHAR(255) NOT NULL,
            update_time DATETIME NULL,
            FOREIGN KEY (folder_id) REFERENCES folder_info(id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'post_info',
        sql: `
          CREATE TABLE IF NOT EXISTS post_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rss_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            author VARCHAR(255) NOT NULL,
            link VARCHAR(255) NOT NULL,
            content BLOB NOT NULL,
            guid VARCHAR(255) NOT NULL UNIQUE,
            read INTEGER NOT NULL DEFAULT 0,
            favorite INTEGER NOT NULL DEFAULT 0,
            update_time DATETIME NOT NULL,
            FOREIGN KEY (rss_id) REFERENCES rss_info(rss_id) ON DELETE CASCADE
          )
        `
      }
    ];

    for (const table of tables) {
      await this.run('CREATE TABLE IF NOT EXISTS ' + table.name + ' ' + table.sql.split('CREATE TABLE IF NOT EXISTS ' + table.name)[1]);
    }
  }

  // Promise化的run方法
  async run(sql: string, params: any[] = []): Promise<void> {
    return this.queue.add(async () => {
      const release = await this.lock.write();
      try {
        return new Promise<void>((resolve, reject) => {
          this.db!.run(sql, params, function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      } finally {
        release();
      }
    });
  }

  // Promise化的get方法（获取单行）
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return this.queue.add(async () => {
      const release = await this.lock.read();
      try {
        return new Promise<T | undefined>((resolve, reject) => {
          this.db!.get(sql, params, (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row as T);
            }
          });
        });
      } finally {
        release();
      }
    });
  }

  // Promise化的all方法（获取多行）
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.queue.add(async () => {
      const release = await this.lock.read();
      try {
        return new Promise<T[]>((resolve, reject) => {
          this.db!.all(sql, params, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows as T[]);
            }
          });
        });
      } finally {
        release();
      }
    });
  }

  // 事务控制
  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    await this.run('BEGIN IMMEDIATE TRANSACTION');
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    await this.run('COMMIT');
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    await this.run('ROLLBACK');
    this.inTransaction = false;
  }

  // 批量操作
  async batch(operations: Array<() => Promise<void>>): Promise<void> {
    await this.beginTransaction();
    try {
      for (const operation of operations) {
        await operation();
      }
      await this.commit();
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  // 关闭数据库
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
