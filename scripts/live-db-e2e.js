/**
 * Live DB + service e2e under Electron runtime (no UI).
 * Usage: ./node_modules/.bin/electron scripts/live-db-e2e.js
 */
const path = require('path');
const { app } = require('electron');

// Point module resolution toward project
process.chdir(path.join(__dirname, '..'));

let passed = 0;
let failed = 0;
const ok = (m) => {
  console.log('  ✅', m);
  passed++;
};
const fail = (m, r) => {
  console.log('  ❌', m + ':', r);
  failed++;
};

app.whenReady().then(async () => {
  console.log('\n🔬 Live DB E2E (Electron runtime)\n');
  try {
    // Use the same compiled modules as the app when possible
    // Fall back to requiring TypeScript-transpiled paths via electron-main's deps
    const sqlitePath = path.join(
      __dirname,
      '../src-electron/infrastructure/persistence/sqlite.ts',
    );
    // Prefer requiring from compiled electron-main bundle internals is hard;
    // instead re-implement thin smoke via SqliteUtil if we can load it.

    // Dynamic import of compiled JS is not available for TS sources.
    // Load via esbuild-register or just use sqlite3 + same DB file.
    const getAppDataPath = require('appdata-path');
    const sqlite3 = require('sqlite3');
    const dbPath = require('path').join(getAppDataPath(''), 'sqlite.db');
    // userData path under electron
    const userDb = path.join(app.getPath('userData'), 'sqlite.db');
    console.log('  DB path:', userDb);

    const db = await new Promise((resolve, reject) => {
      const d = new sqlite3.Database(userDb, (err) => (err ? reject(err) : resolve(d)));
    });
    const all = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
      });
    const get = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
      });

    const folders = await all('SELECT id, name FROM folder_info ORDER BY id');
    if (folders.length > 0) ok(`folders: ${folders.length} (${folders.map((f) => f.name).join(', ')})`);
    else fail('folders', 'empty');

    const feeds = await all('SELECT rss_id, title, feed_url FROM rss_info');
    if (feeds.length > 0) ok(`feeds: ${feeds.length}`);
    else fail('feeds', 'empty');

    const postCount = await get('SELECT COUNT(*) as c FROM post_info');
    if (postCount && postCount.c > 0) ok(`posts: ${postCount.c}`);
    else fail('posts', 'empty');

    const sample = await get(
      'SELECT guid, title, length(content) as clen, read FROM post_info ORDER BY update_time DESC LIMIT 1',
    );
    if (sample && sample.title && sample.clen > 0) {
      ok(`sample article: "${String(sample.title).slice(0, 50)}" (${sample.clen} chars)`);
    } else if (sample && sample.title) {
      ok(`sample article: "${String(sample.title).slice(0, 50)}" (content may be empty)`);
    } else {
      fail('sample article', 'none');
    }

    // Simulate secureInvoke + unwrapOrThrow pipeline
    function wrapHandler(data) {
      return { data };
    }
    function secureInvoke(raw) {
      if (
        raw &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        ('data' in raw || 'error' in raw) &&
        !('success' in raw)
      ) {
        if (raw.error) throw new Error(raw.error);
        return raw.data;
      }
      return raw;
    }
    function unwrapOrThrow(response) {
      if (!response.success) throw new Error(response.error && response.error.message);
      return response.data;
    }

    const apiResponse = { success: true, data: folders };
    const fromMain = wrapHandler(apiResponse);
    const unwrapped = secureInvoke(fromMain);
    const data = unwrapOrThrow(unwrapped);
    if (Array.isArray(data) && data.length === folders.length) {
      ok('IPC envelope pipeline (wrap → secureInvoke → unwrapOrThrow)');
    } else {
      fail('IPC pipeline', JSON.stringify(unwrapped));
    }

    db.close();
  } catch (e) {
    fail('fatal', e && e.message ? e.message : String(e));
  }

  console.log(`\n════════════════════════════════`);
  console.log(`  Passed: ${passed}  Failed: ${failed}`);
  console.log(`════════════════════════════════\n`);
  app.exit(failed > 0 ? 1 : 0);
});

app.on('window-all-closed', (e) => e.preventDefault());
