import { fetchRssIndexList } from '../rss/api'
import { SqliteUtil } from '../storage/sqlite'
import { SourceManage } from '../rss/sourceManage'
import { Notification } from 'electron'
import path from 'path'
import fs from 'fs'

interface SyncConfig {
  enabled: boolean
  interval: number // minutes
  backgroundSync: boolean
  systemTray: boolean
  syncOnStartup: boolean
  notification: boolean
}

interface SyncStats {
  totalSources: number
  successCount: number
  failureCount: number
  newArticlesCount: number
  lastSyncTime: Date
}

export class SyncManager {
  private static instance: SyncManager | null = null
  private timer: NodeJS.Timeout | null = null
  private config: SyncConfig = {
    enabled: false,
    interval: 30,
    backgroundSync: true,
    systemTray: true,
    syncOnStartup: true,
    notification: true
  }
  private isSyncing = false
  private storageUtil: SqliteUtil
  private sourceManager: SourceManage

  private constructor() {
    this.storageUtil = SqliteUtil.getInstance()
    this.sourceManager = SourceManage.getInstance()
    this.loadConfig()
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager()
    }
    return SyncManager.instance
  }

  private getConfigPath(): string {
    // 使用electron的app.getPath获取用户数据目录
    const { app } = require('electron')
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'sync-config.json')
  }

  private loadConfig() {
    try {
      const configPath = this.getConfigPath()
      if (fs.existsSync(configPath)) {
        const saved = fs.readFileSync(configPath, 'utf-8')
        if (saved) {
          this.config = { ...this.config, ...JSON.parse(saved) }
          console.log('[SyncManager] Config loaded from file:', this.config)
        }
      }
    } catch (error) {
      console.error('[SyncManager] Failed to load config:', error)
    }
  }

  private saveConfig() {
    try {
      const configPath = this.getConfigPath()
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2))
      console.log('[SyncManager] Config saved to file')
    } catch (error) {
      console.error('[SyncManager] Failed to save config:', error)
    }
  }

  updateConfig(config: Partial<SyncConfig>) {
    this.config = { ...this.config, ...config }
    this.saveConfig()

    if (this.config.enabled) {
      this.startAutoSync()
    } else {
      this.stopAutoSync()
    }
  }

  getConfig(): SyncConfig {
    return { ...this.config }
  }

  async syncAll(): Promise<SyncStats> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress, skipping...')
      return {
        totalSources: 0,
        successCount: 0,
        failureCount: 0,
        newArticlesCount: 0,
        lastSyncTime: new Date()
      }
    }

    this.isSyncing = true
    console.log('[SyncManager] Starting sync all RSS sources...')

    const stats: SyncStats = {
      totalSources: 0,
      successCount: 0,
      failureCount: 0,
      newArticlesCount: 0,
      lastSyncTime: new Date()
    }

    try {
      // 获取所有RSS源
      const rssInfoList = await this.storageUtil.getRssInfoListFromDb()
      stats.totalSources = rssInfoList.length

      console.log(`[SyncManager] Found ${stats.totalSources} RSS sources to sync`)

      // 并发同步，但限制并发数
      const concurrency = 5
      const batches = this.createBatches(rssInfoList, concurrency)

      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map(async (source: any) => {
            try {
              console.log(`[SyncManager] Syncing: ${source.title}`)
              const result = await fetchRssIndexList(source.rss_id)
              stats.successCount++

              // 统计新文章数量（这里简化处理）
              if (result.success) {
                stats.newArticlesCount += 1
              }

              return { success: true, source: source.title }
            } catch (error) {
              stats.failureCount++
              console.error(`[SyncManager] Failed to sync ${source.title}:`, error)
              return { success: false, source: source.title, error }
            }
          })
        )

        // 显示每个批次的进度
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const { success, source } = result.value
            console.log(`[SyncManager] ${success ? '✓' : '✗'} ${source}`)
          }
        })
      }

      console.log('[SyncManager] Sync completed:', stats)

      // 显示通知
      if (this.config.notification && stats.newArticlesCount > 0) {
        this.showNotification(
          'RSS同步完成',
          `获取到 ${stats.newArticlesCount} 篇新文章`,
          path.resolve(__dirname, '../icons/icon.png')
        )
      }

      return stats
    } catch (error) {
      console.error('[SyncManager] Sync failed:', error)
      throw error
    } finally {
      this.isSyncing = false
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  private showNotification(title: string, body: string, icon?: string) {
    try {
      new Notification({
        title,
        body,
        icon
      }).show()
    } catch (error) {
      console.error('[SyncManager] Failed to show notification:', error)
    }
  }

  startAutoSync() {
    if (this.timer) {
      clearInterval(this.timer)
    }

    if (!this.config.enabled) {
      console.log('[SyncManager] Auto sync is disabled')
      return
    }

    const intervalMs = this.config.interval * 60 * 1000
    console.log(`[SyncManager] Starting auto sync, interval: ${this.config.interval} minutes`)

    this.timer = setInterval(() => {
      console.log('[SyncManager] Auto sync triggered')
      this.syncAll().catch(error => {
        console.error('[SyncManager] Auto sync failed:', error)
      })
    }, intervalMs)

    // 如果启用了启动时同步，立即执行一次
    if (this.config.syncOnStartup) {
      console.log('[SyncManager] Performing startup sync...')
      this.syncAll().catch(error => {
        console.error('[SyncManager] Startup sync failed:', error)
      })
    }
  }

  stopAutoSync() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[SyncManager] Auto sync stopped')
    }
  }

  isRunning(): boolean {
    return this.timer !== null
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      interval: this.config.interval,
      isRunning: this.isRunning(),
      isSyncing: this.isSyncing,
      lastSyncTime: new Date()
    }
  }

  destroy() {
    this.stopAutoSync()
    SyncManager.instance = null
  }
}
