/**
 * SQLite并发控制辅助类
 * 提供读写锁、操作队列和Promise化API
 */

import sqlite3, { Database } from "sqlite3";
import getAppDataPath from "appdata-path";

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
			releaseReaders.forEach((release) => release());
		} else if (this.writers.length > 0) {
			const releaseWriter = this.writers.shift()!;
			releaseWriter();
		}
	}
}

// 操作队列 — 最大队列深度，防止无界堆积
const MAX_QUEUE_DEPTH = 100;

class OperationQueue {
	private queue: Array<() => Promise<any>> = [];
	private processing = false;

	async add<T>(operation: () => Promise<T>): Promise<T> {
		if (this.queue.length >= MAX_QUEUE_DEPTH) {
			return Promise.reject(
				new Error(`OperationQueue overflow: ${this.queue.length} items queued`),
			);
		}

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

	/**
	 * Drain the operation queue sequentially.
	 *
	 * Each queued wrapper already resolves/rejects its own Promise (created
	 * in add()). The try/catch here is a safety net to prevent the while loop
	 * from breaking if a wrapper throws synchronously before its Promise settles.
	 *
	 * Deadlock safety: this method does NOT call add() from within an
	 * operation, so re-entrant queue pushes cannot create circular waits.
	 */
	private async process() {
		this.processing = true;

		while (this.queue.length > 0) {
			const operation = this.queue.shift()!;
			try {
				await operation();
			} catch (error) {
				console.error("[SqliteHelper] OperationQueue error:",
					error instanceof Error ? error.message : String(error));
			}
		}

		this.processing = false;
	}
}

/**
 * Schema migration definition
 */
interface Migration {
	version: number;
	description: string;
	sql: string;
}

/**
 * Ordered list of schema migrations.
 * Each migration is applied exactly once, in version order.
 * Add new migrations at the end - never modify existing ones.
 */
const MIGRATIONS: Migration[] = [
	{
		version: 1,
		description: "Add favorite column to post_info",
		sql: `ALTER TABLE post_info ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0`,
	},
	{
		version: 2,
		description: "Add link index on post_info for fallback queries",
		sql: `CREATE INDEX IF NOT EXISTS idx_post_info_link ON post_info(link)`,
	},
	{
		version: 3,
		description: "Add parent_id index on folder_info",
		sql: `CREATE INDEX IF NOT EXISTS idx_folder_info_parent_id ON folder_info(parent_id)`,
	},
];

export class SqliteHelper {
	private db: Database | null = null;
	private lock = new ReadWriteLock();
	private queue = new OperationQueue();
	private static instance: SqliteHelper | null = null;
	private inTransaction = false;
	private currentSchemaVersion = 0;

	static getInstance(): SqliteHelper {
		if (SqliteHelper.instance === null) {
			SqliteHelper.instance = new SqliteHelper();
		}
		return SqliteHelper.instance;
	}

	async init(): Promise<void> {
		const dbPath = `${getAppDataPath()}/sqlite.db`;

		return new Promise((resolve, reject) => {
			this.db = new Database(
				dbPath,
				sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
				(error) => {
					if (error) {
						console.error("Error opening database:", error);
						reject(error);
						return;
					}

					console.log("Connection with SQLite has been established");

					// 启用外键约束
					this.db!.run("PRAGMA foreign_keys = ON");

					// 启用WAL模式以提高并发性能
					this.db!.run("PRAGMA journal_mode = WAL");

					// 设置超时
					this.db!.run("PRAGMA busy_timeout = 5000");

					// 创建表并运行迁移
					this.createTables()
						.then(() => this.runMigrations())
						.then(() => resolve())
						.catch(reject);
				},
			);
		});
	}

	private async createTables(): Promise<void> {
		// Schema version tracking table
		await this.run(`
      CREATE TABLE IF NOT EXISTS _meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

		// Core tables with full constraints
		await this.run(`
      CREATE TABLE IF NOT EXISTS folder_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        parent_id INTEGER NULL
      )
    `);

		await this.run(`
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
    `);

		await this.run(`
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
    `);

		// Create performance indexes
		await this.createIndexes();

		// Create full-text search FTS5 table
		await this.createFtsTable();
	}

	/**
	 * Create database indexes for query performance
	 */
	private async createIndexes(): Promise<void> {
		const indexes = [
			`CREATE INDEX IF NOT EXISTS idx_rss_info_rss_id ON rss_info(rss_id)`,
			`CREATE INDEX IF NOT EXISTS idx_rss_info_folder_id ON rss_info(folder_id)`,
			`CREATE INDEX IF NOT EXISTS idx_rss_info_update_time ON rss_info(update_time)`,
			`CREATE INDEX IF NOT EXISTS idx_post_info_rss_id ON post_info(rss_id)`,
			`CREATE INDEX IF NOT EXISTS idx_post_info_guid ON post_info(guid)`,
			`CREATE INDEX IF NOT EXISTS idx_post_info_rss_id_update_time ON post_info(rss_id, update_time DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_post_info_read ON post_info(read)`,
			`CREATE INDEX IF NOT EXISTS idx_post_info_author ON post_info(author)`,
			`CREATE INDEX IF NOT EXISTS idx_post_info_link ON post_info(link)`,
			`CREATE INDEX IF NOT EXISTS idx_folder_info_name ON folder_info(name)`,
			`CREATE INDEX IF NOT EXISTS idx_folder_info_parent_id ON folder_info(parent_id)`,
		];

		for (const indexSql of indexes) {
			await this.run(indexSql);
		}
	}

	/**
	 * Create full-text search FTS5 table with triggers
	 */
	private async createFtsTable(): Promise<void> {
		try {
			const rows = await this.all<{ name: string }>(
				`SELECT name FROM sqlite_master WHERE type = ? AND name = ?`,
				["table", "post_info_fts"],
			);

			if (rows.length === 0) {
				console.log("[SqliteHelper] Creating FTS5 virtual table...");

				await this.run(`
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
        `);

				// Create triggers to keep FTS in sync
				await this.run(`
          CREATE TRIGGER post_info_ai AFTER INSERT ON post_info BEGIN
            INSERT INTO post_info_fts(rowid, title, content, author, rss_id, update_time)
            VALUES (new.id, new.title, new.content, new.author, new.rss_id, new.update_time);
          END;
        `);

				await this.run(`
          CREATE TRIGGER post_info_ad AFTER DELETE ON post_info BEGIN
            INSERT INTO post_info_fts(post_info_fts, rowid, title, content, author, rss_id, update_time)
            VALUES ('delete', old.id, old.title, old.content, old.author, old.rss_id, old.update_time);
          END;
        `);

				await this.run(`
          CREATE TRIGGER post_info_au AFTER UPDATE ON post_info BEGIN
            INSERT INTO post_info_fts(post_info_fts, rowid, title, content, author, rss_id, update_time)
            VALUES ('delete', old.id, old.title, old.content, old.author, old.rss_id, old.update_time);
            INSERT INTO post_info_fts(rowid, title, content, author, rss_id, update_time)
            VALUES (new.id, new.title, new.content, new.author, new.rss_id, new.update_time);
          END;
        `);

				console.log("[SqliteHelper] FTS5 table created successfully");
			}
		} catch (error) {
			console.error("[SqliteHelper] Failed to create FTS table:", error);
		}
	}

	// Promise化的run方法
	async run(sql: string, params: any[] = []): Promise<void> {
		return this.queue.add(async () => {
			const release = await this.lock.write();
			try {
				return new Promise<void>((resolve, reject) => {
					this.db!.run(sql, params, (err) => {
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
			throw new Error("Transaction already in progress");
		}
		await this.run("BEGIN IMMEDIATE TRANSACTION");
		this.inTransaction = true;
	}

	async commit(): Promise<void> {
		if (!this.inTransaction) {
			throw new Error("No transaction in progress");
		}
		await this.run("COMMIT");
		this.inTransaction = false;
	}

	async rollback(): Promise<void> {
		if (!this.inTransaction) {
			throw new Error("No transaction in progress");
		}
		await this.run("ROLLBACK");
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

	/**
	 * Execute a callback within a transaction.
	 * Automatically commits on success or rolls back on error.
	 */
	async transaction<T>(fn: () => Promise<T>): Promise<T> {
		await this.beginTransaction();
		try {
			const result = await fn();
			await this.commit();
			return result;
		} catch (error) {
			await this.rollback();
			throw error;
		}
	}

	/**
	 * Run pending schema migrations in order.
	 * Each migration is applied exactly once based on the version stored in _meta.
	 */
	private async runMigrations(): Promise<void> {
		try {
			// Get current schema version
			const row = await this.get<{ value: string }>(
				`SELECT value FROM _meta WHERE key = ?`,
				["schema_version"],
			);
			this.currentSchemaVersion = row ? parseInt(row.value, 10) : 0;

			console.log(
				`[SqliteHelper] Current schema version: ${this.currentSchemaVersion}`,
			);

			// Apply pending migrations in order
			let applied = 0;
			for (const migration of MIGRATIONS) {
				if (migration.version > this.currentSchemaVersion) {
					console.log(
						`[SqliteHelper] Running migration v${migration.version}: ${migration.description}`,
					);
					try {
						await this.run(migration.sql);
						this.currentSchemaVersion = migration.version;
						applied++;
					} catch (migrationError: any) {
						// Gracefully handle idempotent migrations (e.g., adding columns that already exist)
						if (
							migrationError.message &&
							migrationError.message.includes("duplicate column name")
						) {
							console.warn(
								`[SqliteHelper] Migration v${migration.version} skipped (column already exists): ${migrationError.message}`,
							);
							this.currentSchemaVersion = migration.version;
							applied++;
						} else {
							throw migrationError;
						}
					}
				}
			}

			// Persist the latest version
			if (applied > 0) {
				await this.run(
					`INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)`,
					["schema_version", String(this.currentSchemaVersion)],
				);
				console.log(
					`[SqliteHelper] Migrations complete — applied ${applied}, now at v${this.currentSchemaVersion}`,
				);
			}
		} catch (error) {
			console.error("[SqliteHelper] Migration failed:", error);
			throw error;
		}
	}

	/**
	 * Check database connection health.
	 * Returns true if the connection is alive and responsive.
	 */
	async healthCheck(): Promise<boolean> {
		try {
			if (!this.db) return false;
			const row = await this.get<{ ok: number }>("SELECT 1 as ok");
			return row?.ok === 1;
		} catch {
			return false;
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
						console.log("Database connection closed");
						resolve();
					}
				});
			} else {
				resolve();
			}
		});
	}

	getDatabase(): Database | null {
		return this.db;
	}
}
