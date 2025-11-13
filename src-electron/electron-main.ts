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


// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

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
