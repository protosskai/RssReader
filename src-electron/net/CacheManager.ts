// 缓存管理类，用于存储和管理RSS请求的缓存数据

// 缓存项接口
interface CacheItem {
  data: string;          // 缓存的数据内容
  timestamp: number;     // 缓存创建的时间戳
  expireTime?: number;   // 缓存过期的时间戳（可选）
}

// 默认缓存过期时间：5分钟（毫秒）
const DEFAULT_EXPIRY_TIME = 5 * 60 * 1000;

// 最大缓存项数量
const MAX_CACHE_ITEMS = 100;

export class CacheManager {
  // 单例模式实例
  private static instance: CacheManager;
  
  // 缓存存储，使用Map存储键值对
  private cache: Map<string, CacheItem>;
  
  // 私有构造函数
  private constructor() {
    this.cache = new Map<string, CacheItem>();
    this.setupAutoCleanup();
  }
  
  // 获取单例实例
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }
  
  // 设置自动清理过期缓存的定时器
  private setupAutoCleanup(): void {
    // 每30分钟清理一次过期缓存
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 30 * 60 * 1000);
  }
  
  // 添加缓存项
  set(key: string, data: string, expiryTime?: number): void {
    // 确保缓存不超过最大限制
    if (this.cache.size >= MAX_CACHE_ITEMS && !this.cache.has(key)) {
      this.evictOldestCache();
    }
    
    const timestamp = Date.now();
    const expireTime = expiryTime ? timestamp + expiryTime : timestamp + DEFAULT_EXPIRY_TIME;
    
    this.cache.set(key, {
      data,
      timestamp,
      expireTime
    });
  }
  
  // 获取缓存项
  get(key: string): string | null {
    const cacheItem = this.cache.get(key);
    
    if (!cacheItem) {
      return null;
    }
    
    // 检查是否过期
    const now = Date.now();
    if (cacheItem.expireTime && now > cacheItem.expireTime) {
      this.cache.delete(key);
      return null;
    }
    
    return cacheItem.data;
  }
  
  // 清理指定的缓存项
  remove(key: string): void {
    this.cache.delete(key);
  }
  
  // 清理所有缓存
  clear(): void {
    this.cache.clear();
  }
  
  // 清理过期缓存
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expireTime && now > item.expireTime) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`已清理 ${deletedCount} 个过期缓存项`);
    }
  }
  
  // 当缓存达到最大限制时，移除最旧的缓存项
  private evictOldestCache(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  // 获取当前缓存大小
  getSize(): number {
    return this.cache.size;
  }
  
  // 手动刷新缓存（重新请求但保持缓存）
  refresh(key: string, data: string, expiryTime?: number): void {
    this.set(key, data, expiryTime);
  }
}

// 导出单例实例
export const cacheManager = CacheManager.getInstance();