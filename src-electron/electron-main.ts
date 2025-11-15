import {app, BrowserWindow, ipcMain, nativeTheme, shell} from 'electron';
import path from 'path';
import os from 'os';
import {
  openLink,
  addRssSubscription,
  addFolder,
  removeFolder,
  removeRssSubscription,
  importOpmlFile,
  dumpFolderToDb,
  loadFolderFromDb, getRssInfoListFromDb, editFolder,
  queryPostIndexByRssId, queryPostContentByGuid, fetchRssIndexList, initDB
} from "src-electron/rss/api";
import { getArticleService } from './infrastructure/Container';


// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

// 初始化Article Service
const articleService = getArticleService();

try {
  if (platform === 'win32' && nativeTheme.shouldUseDarkColors) {
    require('fs').unlinkSync(
      path.join(app.getPath('userData'), 'DevTools Extensions')
    );
  }
} catch (_) {
}

let mainWindow: BrowserWindow | undefined;

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, 'icons/icon.png'), // tray icon
    width: 1280,
    height: 960,
    useContentSize: true,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD),
    },
  });

  mainWindow.loadURL(process.env.APP_URL);

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

app.whenReady().then(() => {
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
  ipcMain.handle('rss:getRssInfoListFromDb', async () => {
    return await getRssInfoListFromDb()
  })
  ipcMain.handle('rss:queryPostIndexByRssId', async (event, ...args) => {
    const [rssId] = args
    return await queryPostIndexByRssId(rssId)
  })
  
  ipcMain.handle('rss:fetchRssIndexList', async (event, ...args) => {
    const [rssId] = args
    return await fetchRssIndexList(rssId)
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

  initDB().then(() => {
    createWindow()
  })
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
