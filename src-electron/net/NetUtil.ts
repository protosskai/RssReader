import {net} from 'electron'
import {cacheManager} from './CacheManager'

/**
 * 获取URL内容，支持缓存机制
 * @param url - 要请求的URL
 * @param useCache - 是否使用缓存（默认为true）
 * @param cacheExpiry - 缓存过期时间（毫秒），不提供则使用默认值
 * @returns URL内容
 */
export const getUrl = async (url: string, useCache: boolean = true, cacheExpiry?: number): Promise<string> => {
  // 检查是否使用缓存，如果是，则尝试从缓存中获取
  if (useCache) {
    const cachedData = cacheManager.get(url);
    if (cachedData) {
      console.log(`从缓存获取URL内容: ${url}`);
      return cachedData;
    }
  }

  // 缓存未命中，发起实际请求
  return new Promise<string>((resolve, reject) => {
    const request = net.request(url)
    
    // 使用外部setTimeout替代不存在的setTimeout方法
    const timeoutId = setTimeout(() => {
      reject(new Error(`Request timeout after 30 seconds: ${url}`))
      request.abort()
    }, 30000)
    
    request.on('response', (response) => {
      // 清除超时定时器
      clearTimeout(timeoutId)
      
      // 检查状态码
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP error! Status: ${response.statusCode}`))
        return
      }
      
      // 修改为兼容的类型
      const chunks: Uint8Array[] = [];
      response.on('data', (data) => {
        chunks.push(data)
      })
      response.on('end', () => {
        try {
          // 手动处理缓冲区拼接
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const resultBuffer = Buffer.alloc(totalLength);
          let offset = 0;
          
          for (const chunk of chunks) {
            resultBuffer.set(chunk, offset);
            offset += chunk.length;
          }
          
          const result = resultBuffer.toString();
          
          // 如果使用缓存，将结果存入缓存
          if (useCache) {
            cacheManager.set(url, result, cacheExpiry);
          }
          
          resolve(result)
        } catch (error: any) {
          reject(new Error(`Failed to process response: ${error instanceof Error ? error.message : String(error)}`))
        }
      })
      response.on('error', (error: Error) => {
        clearTimeout(timeoutId)
        reject(new Error(`Response error: ${error.message}`))
      })
      response.on('aborted', () => {
        clearTimeout(timeoutId)
        reject(new Error('Response aborted'))
      })
    })
    request.on('error', (error) => {
      clearTimeout(timeoutId)
      reject(new Error(`Request error: ${error.message}`))
    })
    request.end()
  })
}
