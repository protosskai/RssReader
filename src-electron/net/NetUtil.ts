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
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [NetUtil.ts] getUrl called`);
  console.log(`[${timestamp}] [NetUtil.ts] URL:`, url);
  console.log(`[${timestamp}] [NetUtil.ts] useCache:`, useCache);

  // 检查是否使用缓存，如果是，则尝试从缓存中获取
  if (useCache) {
    console.log(`[${timestamp}] [NetUtil.ts] Checking cache...`);
    const cachedData = cacheManager.get(url);
    if (cachedData) {
      console.log(`[${timestamp}] [NetUtil.ts] Cache hit! Returning cached content for: ${url}`);
      return cachedData;
    }
    console.log(`[${timestamp}] [NetUtil.ts] Cache miss, will fetch from network`);
  }

  // 缓存未命中，发起实际请求
  console.log(`[${timestamp}] [NetUtil.ts] Starting network request...`);
  return new Promise<string>((resolve, reject) => {
    const request = net.request({
      url: url,
      // 添加用户代理，模拟浏览器请求
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const timeoutId = setTimeout(() => {
      console.error(`[${timestamp}] [NetUtil.ts] Request timeout after 30 seconds for URL: ${url}`);
      reject(new Error(`Request timeout after 30 seconds: ${url}`))
      request.abort()
    }, 30000)

    request.on('response', (response) => {
      console.log(`[${timestamp}] [NetUtil.ts] Response received for URL: ${url}`);
      console.log(`[${timestamp}] [NetUtil.ts] Status code:`, response.statusCode);

      // 清除超时定时器
      clearTimeout(timeoutId)

      // 检查状态码
      if (response.statusCode < 200 || response.statusCode >= 300) {
        console.error(`[${timestamp}] [NetUtil.ts] HTTP error! Status: ${response.statusCode}`);
        reject(new Error(`HTTP error! Status: ${response.statusCode}`))
        return
      }

      // 修改为兼容的类型
      const chunks: Uint8Array[] = [];
      response.on('data', (data) => {
        chunks.push(data)
      })
      response.on('end', () => {
        console.log(`[${timestamp}] [NetUtil.ts] Response complete, processing...`);
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
          console.log(`[${timestamp}] [NetUtil.ts] Response processed successfully, length:`, result.length);

          // 如果使用缓存，将结果存入缓存
          if (useCache) {
            console.log(`[${timestamp}] [NetUtil.ts] Saving to cache...`);
            cacheManager.set(url, result, cacheExpiry);
          }

          resolve(result)
        } catch (error: any) {
          console.error(`[${timestamp}] [NetUtil.ts] Failed to process response:`, error);
          reject(new Error(`Failed to process response: ${error instanceof Error ? error.message : String(error)}`))
        }
      })
      response.on('error', (error: Error) => {
        console.error(`[${timestamp}] [NetUtil.ts] Response error:`, error);
        clearTimeout(timeoutId)
        reject(new Error(`Response error: ${error.message}`))
      })
      response.on('aborted', () => {
        console.error(`[${timestamp}] [NetUtil.ts] Response aborted for URL: ${url}`);
        clearTimeout(timeoutId)
        reject(new Error('Response aborted'))
      })
    })
    request.on('error', (error) => {
      console.error(`[${timestamp}] [NetUtil.ts] Request error:`, error);
      clearTimeout(timeoutId)
      reject(new Error(`Request error: ${error.message}`))
    })
    console.log(`[${timestamp}] [NetUtil.ts] Sending request...`);
    request.end()
  })
}
