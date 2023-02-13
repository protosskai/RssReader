import {app, BrowserWindow, ipcMain, nativeTheme, shell} from 'electron';
import path from 'path';
import os from 'os';
import {
  getPostListInfo,
  getRssContent,
  getPostContent,
  openLink,
  addRssSubscription,
  addFolder,
  removeFolder,
  removeRssSubscription,
  importOpmlFile,
  dumpFolderToDb,
  loadFolderFromDb, getRssInfoListFromDb, editFolder,
  queryPostIndexByRssId
} from "src-electron/rss/api";


// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

try {
  if (platform === 'win32' && nativeTheme.shouldUseDarkColors === true) {
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

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

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
  ipcMain.handle('rss:rssContent', async (event, ...args) => {
    const [rssItemId] = args
    return await getRssContent(rssItemId)
  })
  ipcMain.handle('rss:getPostList', async (event, ...args) => {
    const [rssItemId] = args
    return await getPostListInfo(rssItemId)
  })
  ipcMain.handle('rss:getPostContent', async (event, ...args) => {
    const [rssItemId, postId] = args
    return getPostContent(rssItemId, postId)
  })
  ipcMain.handle('rss:addRssSubscription', async (event, ...args) => {
    const [obj] = args
    return await addRssSubscription(obj)
  })
  ipcMain.handle('rss:removeRssSubscription', async (event, ...args) => {
    const [folderName, rssUrl] = args
    return await removeRssSubscription(folderName, rssUrl)
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
  createWindow()
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
