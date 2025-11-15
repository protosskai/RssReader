# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Quasar Framework (Vue.js) + Electron** desktop RSS reader application. The app uses SQLite for local data storage and IPC (Inter-Process Communication) for renderer-main process communication.

## Common Development Commands

### Installation & Setup
```bash
# Install dependencies
yarn
# or
npm install

# Start development server (SPA mode)
yarn dev
# or
npx quasar dev

# Build for production
yarn build
# or
npx quasar build

# Serve built SPA
yarn serve
# or
npx quasar serve dist/spa
```

### Electron Commands
```bash
# Start in Electron development mode
yarn dev:electron
# or
npx quasar dev -m electron

# Build Electron application
yarn build:electron
# or
npx quasar build -m electron
```

### Testing
```bash
yarn test
# Note: Currently echoes "No test specified"
```

## Architecture Overview

### Frontend (Renderer Process)
- **Framework**: Quasar Framework (Vue.js 3 + Vite)
- **State Management**: Pinia stores located in `src/stores/`
- **Routing**: Vue Router with hash mode (`src/router/`)
- **UI Layout**: AppLayout with header, drawer, and page container
- **Build**: Vite-based build system configured in `quasar.config.js`

### Electron Backend (Main Process)
- **Entry Point**: `src-electron/electron-main.ts`
- **Preload Script**: `src-electron/electron-preload.ts` (exposes `window.electronAPI`)
- **Database**: SQLite with custom wrapper in `src-electron/storage/sqlite.ts`
- **RSS Processing**: RSS parsing and management in `src-electron/rss/`
- **Network**: HTTP utilities in `src-electron/net/`

### Database Schema
Three main tables in SQLite:
1. **folder_info**: RSS folder structure (id, name, parent_id)
2. **rss_info**: RSS subscription details (id, folder_id, title, feed_url, etc.)
3. **post_info**: Individual RSS posts/articles (rss_id, title, content, guid, etc.)
4. **favorite**: User-favorited posts

### Key Components Structure

#### Pinia Stores (`src/stores/`)
- **rssInfoStore.ts**: Manages RSS folders and subscriptions, communicates via `window.electronAPI`
- **favoriteStore.ts**: Handles favorite posts management
- **searchStore.ts**: Search functionality
- **systemDialogStore.ts**: System dialog state

#### Pages (`src/pages/`)
- **HomePage.vue**: Main dashboard
- **PostList.vue**: RSS feed posts list
- **Content.vue**: Article content viewer
- **SettingPage.vue**: Application settings
- **FavoritePage.vue**: Favorites management

#### Layouts (`src/layouts/`)
- **AppLayout.vue**: Root layout with header, drawer, and page container
- **AppHeader.vue**: Application header with window controls
- **AppDrawer.vue**: Left sidebar navigation

#### Components (`src/components/`)
- Dialogs: AddSubscription, EditSubscription, MoveFolder, etc.
- Lists: SubscriptionList, PostListItem
- SearchComponent: Search functionality

### IPC Communication
Renderer process communicates with main process via `window.electronAPI`:
- `addRssSubscription()`, `removeRssSubscription()`
- `getRssInfoListFromDb()`, `queryPostIndexByRssId()`
- `queryPostContentByGuid()`, `fetchRssIndexList()`
- `addFolder()`, `removeFolder()`, `editFolder()`
- Window controls: `openLink()`, `close()`, `minimize()`
- OPML import/export: `importOpmlFile()`, `dumpFolderToDb()`

### RSS Processing Flow
1. **Source Management**: `src-electron/rss/sourceManage.ts` manages RSS sources
2. **Feed Parsing**: `src-electron/rss/parser/FeedParser.ts` parses RSS/Atom feeds
3. **Post Management**: `src-electron/rss/postListManeger.ts` handles post storage/retrieval
4. **API Layer**: `src-electron/rss/api.ts` provides main process handlers

## Important Files

### Configuration
- `quasar.config.js`: Quasar CLI configuration (build targets, dev server, Electron settings)
- `package.json`: Dependencies and scripts (requires Node 16-18, npm/yarn)
- `src/electron.d.ts`: TypeScript declarations for `window.electronAPI`

### Common Types
- `src/common/RssInfoItem.ts`: RSS folder and source types
- `src/common/PostInfoItem.ts`: Post/article types
- `src/common/ContentInfo.ts`: Content display types
- `src/common/ErrorMsg.ts`: Error handling types

## Development Notes

### Hot Reloading
- Development mode enables hot-code reloading via Vite
- Electron dev mode automatically opens DevTools for debugging
- See `quasar.config.js:82-85` for dev server configuration

### Build Configuration
- Vue Router Mode: Hash (for Electron compatibility)
- Browser Target: ES2019+
- Node Target: Node 16
- Electron Packager configuration in `quasar.config.js:167-193`

### Database Location
SQLite database file is stored at: `{userData}/sqlite.db` (via `appdata-path`)

### Window Controls
Custom title bar with custom window controls (close, minimize) implemented via Electron API

### Security
- Context isolation enabled in Electron window
- Preload script bridges renderer and main processes securely
- External links opened in default browser via `shell.openExternal()`

## Key Dependencies
- **Quasar Framework**: UI components and build system
- **Pinia**: State management
- **Vue Router**: Client-side routing
- **Electron**: Desktop app framework
- **SQLite3**: Local database
- **Axios**: HTTP client (boot file: `src/boot/axios.ts`)
- **XML2JS**: RSS/XML parsing
- **Moment.js**: Date formatting
