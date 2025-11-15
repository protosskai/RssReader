import {app, BrowserWindow, ipcMain, nativeTheme, shell} from 'electron';
import path from 'path';
import os from 'os';
import http from 'http';
import {
  openLink,
  addRssSubscription,
  addFolder,
  removeFolder,
  removeRssSubscription,
  importOpmlFile,
  dumpFolderToDb,
  loadFolderFromDb, getRssInfoListFromDb, editFolder,
  queryPostIndexByRssId, queryPostContentByGuid, fetchRssIndexList, initDB, searchPosts
} from "src-electron/rss/api";
import { getArticleService } from './infrastructure/Container';
import { SyncManager } from './services/SyncManager';


// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

// 初始化Article Service
const articleService = getArticleService();

// 初始化Sync Manager
const syncManager = SyncManager.getInstance();

try {
  if (platform === 'win32' && nativeTheme.shouldUseDarkColors) {
    require('fs').unlinkSync(
      path.join(app.getPath('userData'), 'DevTools Extensions')
    );
  }
} catch (_) {
}

let mainWindow: BrowserWindow | undefined;

/**
 * 等待dev server ready
 * @param maxRetries 最大重试次数
 * @param retryDelay 重试间隔（毫秒）
 */
async function waitForDevServer(maxRetries: number = 30, retryDelay: number = 1000): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:9000';
  const serverUrl = new URL(appUrl);
  const hostname = serverUrl.hostname;
  const port = serverUrl.port || (serverUrl.protocol === 'https:' ? '443' : '80');

  console.log(`[electron-main] Waiting for dev server at ${hostname}:${port}...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get({
          hostname,
          port,
          path: '/',
          timeout: 1000
        }, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            reject(new Error(`Server returned status ${res.statusCode}`));
          }
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.setTimeout(1000);
      });

      console.log(`[electron-main] Dev server is ready! (attempt ${i + 1}/${maxRetries})`);
      return;
    } catch (error) {
      console.log(`[electron-main] Waiting for dev server... (attempt ${i + 1}/${maxRetries})`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error(`Dev server failed to start after ${maxRetries} attempts`);
}

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, 'icons/icon.png'), // tray icon
    width: 1280,
    height: 960,
    minWidth: 800,        // 最小宽度，保证在小屏幕上也能使用
    minHeight: 600,       // 最小高度
    useContentSize: true, // 窗口大小包含标题栏
    frame: false,         // 无边框窗口，但可以调整大小
    resizable: true,      // 允许调整窗口大小
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD),
    },
  });

  const appUrl = process.env.APP_URL;
  console.log(`[electron-main] Loading URL: ${appUrl}`);
  mainWindow.loadURL(appUrl);

  // 开发调试期间，始终打开开发者工具以便查看调试日志
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    shell.openExternal(url)
  })
  mainWindow.webContents.setWindowOpenHandler((data) => {
    shell.openExternal(data.url)
    return {
      action: 'deny'
    }
  })
}

app.whenReady().then(async () => {
  try {
    // 首先初始化数据库
    console.log('[electron-main] Initializing database...');
    await initDB();
    console.log('[electron-main] Database initialized successfully');
  } catch (error) {
    console.error('[electron-main] Failed to initialize database:', error);
    throw error;
  }

  // 数据库初始化完成后，再设置IPC处理器
  ipcMain.handle('rss:addRssSubscription', async (event, ...args) => {
    const [obj] = args
    return await addRssSubscription(obj)
  })
  ipcMain.handle('rss:removeRssSubscription', async (event, ...args) => {
    const [folderName, rssUrl] = args
    return await removeRssSubscription(folderName, rssUrl)
  })
  ipcMain.handle('rss:queryPostContentByGuid', async (event, ...args) => {
    console.log('[electron-main] rss:queryPostContentByGuid event received, args:', args);
    const [postId] = args;
    console.log('[electron-main] rss:queryPostContentByGuid extracting postId:', postId);
    try {
      console.log('[electron-main] rss:queryPostContentByGuid calling queryPostContentByGuid API');
      const result = await queryPostContentByGuid(postId);
      console.log('[electron-main] rss:queryPostContentByGuid API returned result:', result);
      return result;
    } catch (error) {
      console.error('[electron-main] rss:queryPostContentByGuid error:', error);
      throw error;
    }
  })
  ipcMain.handle('rss:importOpmlFile', importOpmlFile)
  ipcMain.handle('openLink', async (event, ...args) => {
    const [url] = args
    return openLink(url)
  })
  ipcMain.handle('close', () => {
    // app.exit(0)
    BrowserWindow.getFocusedWindow()?.close()
  })
  ipcMain.handle('minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  ipcMain.handle('addFolder', async (event, ...args) => {
    const [folderName] = args
    return await addFolder(folderName)
  })
  ipcMain.handle('editFolder', async (event, ...args) => {
    const [oldFolderName, newFolderName] = args;
    return await editFolder(oldFolderName, newFolderName);
  })
  ipcMain.handle('removeFolder', async (event, ...args) => {
    const [folderName] = args;
    return await removeFolder(folderName);
  })
  ipcMain.handle('rss:dumpFolderToDb', async (event, ...args) => {
    const [folderInfoListJson] = args
    return await dumpFolderToDb(folderInfoListJson)
  })
  ipcMain.handle('rss:loadFolderFromDb', async () => {
    return await loadFolderFromDb()
  })
  ipcMain.handle('rss:getRssInfoListFromDb', async (event, ...args) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [electron-main] rss:getRssInfoListFromDb called`);
      console.log(`[${timestamp}] [electron-main] Event:`, event);
      console.log(`[${timestamp}] [electron-main] Args:`, args);
      console.log(`[${timestamp}] [electron-main] Starting getRssInfoListFromDb...`);

      // 添加超时保护
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000);
      });

      const resultPromise = getRssInfoListFromDb();

      const result = await Promise.race([resultPromise, timeoutPromise]);

      console.log(`[${timestamp}] [electron-main] rss:getRssInfoListFromDb SUCCESS, result:`, result);
      console.log(`[${timestamp}] [electron-main] Result type:`, typeof result);
      console.log(`[${timestamp}] [electron-main] Result length:`, Array.isArray(result) ? result.length : 'N/A');

      return result;
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [electron-main] rss:getRssInfoListFromDb ERROR:`, error);
      console.error(`[${timestamp}] [electron-main] Error stack:`, error.stack);
      throw error;
    }
  })
  ipcMain.handle('rss:queryPostIndexByRssId', async (event, ...args) => {
    const timestamp = new Date().toISOString();
    const [rssId] = args;

    console.log(`[${timestamp}] [electron-main] rss:queryPostIndexByRssId called`);
    console.log(`[${timestamp}] [electron-main] rssId:`, rssId);
    console.log(`[${timestamp}] [electron-main] Args:`, args);

    try {
      // 添加超时保护
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000);
      });

      const queryPromise = queryPostIndexByRssId(rssId);
      console.log(`[${timestamp}] [electron-main] Starting queryPostIndexByRssId...`);

      const result = await Promise.race([queryPromise, timeoutPromise]);

      console.log(`[${timestamp}] [electron-main] rss:queryPostIndexByRssId SUCCESS`);
      console.log(`[${timestamp}] [electron-main] Result type:`, typeof result);
      console.log(`[${timestamp}] [electron-main] Result length:`, Array.isArray(result) ? result.length : 'N/A');
      console.log(`[${timestamp}] [electron-main] Result:`, result);

      return result;
    } catch (error) {
      console.error(`[${timestamp}] [electron-main] rss:queryPostIndexByRssId ERROR:`, error);
      console.error(`[${timestamp}] [electron-main] Error stack:`, error.stack);
      throw error;
    }
  })

  ipcMain.handle('rss:fetchRssIndexList', async (event, ...args) => {
    const timestamp = new Date().toISOString();
    const [rssId] = args;
    console.log(`[${timestamp}] [electron-main] rss:fetchRssIndexList called`);
    console.log(`[${timestamp}] [electron-main] rssId:`, rssId);

    try {
      console.log(`[${timestamp}] [electron-main] Starting fetchRssIndexList...`);
      const result = await fetchRssIndexList(rssId);
      console.log(`[${timestamp}] [electron-main] fetchRssIndexList SUCCESS:`, result);
      return result;
    } catch (error) {
      console.error(`[${timestamp}] [electron-main] fetchRssIndexList ERROR:`, error);
      console.error(`[${timestamp}] [electron-main] Error stack:`, error.stack);
      throw error;
    }
  })

  // 新API处理器（基于Article架构）
  // Article operations
  ipcMain.handle('article:getArticles', async (event, ...args) => {
    const [params] = args
    const { filter, offset, limit } = params || {}
    return await articleService.getArticles(filter, offset, limit)
  })
  ipcMain.handle('article:getArticle', async (event, ...args) => {
    const [id] = args
    return await articleService.getArticle(id)
  })
  ipcMain.handle('article:toggleReadStatus', async (event, ...args) => {
    const [id] = args
    return await articleService.toggleReadStatus(id)
  })
  ipcMain.handle('article:toggleFavorite', async (event, ...args) => {
    const [id] = args
    return await articleService.toggleFavorite(id)
  })
  ipcMain.handle('article:markAllAsRead', async (event, ...args) => {
    const [params] = args
    return await articleService.markAllAsRead(params)
  })
  ipcMain.handle('article:clearAllFavorites', async () => {
    return await articleService.clearAllFavorites()
  })
  ipcMain.handle('article:getStats', async () => {
    return await articleService.getStats()
  })

  // Feed operations
  ipcMain.handle('feed:getFeeds', async (event, ...args) => {
    const [folderName] = args
    return await articleService.getFeeds(folderName)
  })
  ipcMain.handle('feed:getFeed', async (event, ...args) => {
    const [id] = args
    return await articleService.getFeed(id)
  })
  ipcMain.handle('feed:addFeed', async (event, ...args) => {
    const [{ feedUrl, title, folderName }] = args
    return await articleService.addFeed(feedUrl, title, folderName)
  })
  ipcMain.handle('feed:removeFeed', async (event, ...args) => {
    const [id] = args
    return await articleService.removeFeed(id)
  })
  ipcMain.handle('feed:syncFeed', async (event, ...args) => {
    const [id] = args
    return await articleService.syncFeed(id)
  })

  // Folder operations
  ipcMain.handle('folder:getFolders', async () => {
    return await articleService.getFolders()
  })
  ipcMain.handle('folder:getFolder', async (event, ...args) => {
    const [name] = args
    return await articleService.getFolder(name)
  })
  ipcMain.handle('folder:addFolder', async (event, ...args) => {
    const [name] = args
    return await articleService.addFolder(name)
  })
  ipcMain.handle('folder:removeFolder', async (event, ...args) => {
    const [name] = args
    return await articleService.removeFolder(name)
  })
  ipcMain.handle('folder:renameFolder', async (event, ...args) => {
    const [oldName, newName] = args
    return await articleService.renameFolder(oldName, newName)
  })

  // Favorite operations (legacy support)
  ipcMain.handle('article:getFavoritePosts', async () => {
    const result = await articleService.getArticles({ favorite: true }, 0, 1000)
    return result.articles
  })
  ipcMain.handle('article:addFavoritePost', async (event, ...args) => {
    const [post] = args
    // Convert PostIndexItem to Article and save
    const article = {
      id: post.guid,
      title: post.title,
      content: post.content,
      description: post.desc,
      link: post.link,
      author: post.author,
      publishDate: new Date(post.updateTime),
      updateTime: new Date(post.updateTime),
      read: post.read,
      favorite: true,
      feedId: post.rssId,
      feedTitle: '',
      feedUrl: '',
      folderName: ''
    }
    return await articleService.toggleFavorite(article.id)
  })
  ipcMain.handle('article:removeFavoritePost', async (event, ...args) => {
    const [guid] = args
    return await articleService.toggleFavorite(guid)
  })
  ipcMain.handle('article:isPostFavorite', async (event, ...args) => {
    const [guid] = args
    const article = await articleService.getArticle(guid)
    return article?.favorite || false
  })

  // 同步管理相关IPC处理器
  ipcMain.handle('sync:getConfig', async () => {
    return syncManager.getConfig()
  })

  ipcMain.handle('sync:updateConfig', async (event, config) => {
    syncManager.updateConfig(config)
    return { success: true }
  })

  ipcMain.handle('sync:start', async () => {
    try {
      const stats = await syncManager.syncAll()
      return { success: true, stats }
    } catch (error) {
      console.error('[electron-main] Manual sync failed:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('sync:getStatus', async () => {
    return syncManager.getStatus()
  })

  ipcMain.handle('sync:startAuto', async () => {
    syncManager.startAutoSync()
    return { success: true }
  })

  ipcMain.handle('sync:stopAuto', async () => {
    syncManager.stopAutoSync()
    return { success: true }
  })

  // 搜索相关IPC处理器
  ipcMain.handle('search:searchPosts', async (event, ...args) => {
    const [query, options] = args
    return await searchPosts(query, options)
  })

  // 所有IPC处理器注册完成后，等待dev server ready再创建窗口
  console.log('[electron-main] All IPC handlers registered, waiting for dev server...');
  try {
    await waitForDevServer();
    console.log('[electron-main] Dev server is ready, creating window...');
    createWindow();
  } catch (error) {
    console.error('[electron-main] Failed to wait for dev server:', error);
    console.error('[electron-main] Please check if dev server is running on the correct port');
    console.error('[electron-main] App will not start without dev server');
    app.quit();
  }
});
app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === undefined) {
    createWindow();
  }
});
