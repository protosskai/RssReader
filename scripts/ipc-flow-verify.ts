/**
 * Main-process IPC flow verification (no UI).
 * Mirrors what the renderer does after secureInvoke unwrap:
 *   wrapHandler → { data: ApiResponse | T } → secureInvoke → ApiResponse | T
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true,"skipLibCheck":true}' scripts/ipc-flow-verify.ts
 */

import path from 'path';

// Boot minimal electron app environment pieces used by the DB layer
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

async function main() {
  let passed = 0;
  let failed = 0;
  const ok = (m: string) => {
    console.log(`  ✅ ${m}`);
    passed++;
  };
  const fail = (m: string, r: string) => {
    console.log(`  ❌ ${m}: ${r}`);
    failed++;
  };

  console.log('\n🔬 IPC / Data-layer flow verify\n');

  // Dynamic require so ts-node can resolve project paths after electron is available
  // We test the same code paths without spinning BrowserWindow.

  // Simulate secureInvoke unwrap (fixed)
  function secureInvokeSim<T>(raw: unknown): T {
    if (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      ('data' in raw || 'error' in raw) &&
      !('success' in (raw as object))
    ) {
      const env = raw as { error?: string; data?: T };
      if (env.error) throw new Error(env.error);
      return env.data as T;
    }
    return raw as T;
  }

  function wrapHandlerSim<T>(fn: () => Promise<T>) {
    return async (): Promise<{ data?: T; error?: string }> => {
      try {
        return { data: await fn() };
      } catch (e: any) {
        return { error: e?.message || String(e) };
      }
    };
  }

  const {
    createSuccessResponse,
    unwrapOrThrow,
  } = await import('../src/common/ErrorMsg');

  // Envelope round-trip for legacy API
  const foldersPayload = [
    { folderName: '默认', data: [{ id: '1', title: 'HN', unread: 3, htmlUrl: '', feedUrl: 'https://x' }], children: [] },
  ];
  const wrapped = await wrapHandlerSim(async () => createSuccessResponse(foldersPayload))();
  try {
    const api = secureInvokeSim(wrapped) as any;
    const folders = unwrapOrThrow(api) as typeof foldersPayload;
    if (folders[0].folderName === '默认' && folders[0].data[0].title === 'HN') {
      ok('Legacy ApiResponse round-trip (list + unwrapOrThrow)');
    } else fail('Legacy round-trip', JSON.stringify(folders));
  } catch (e: any) {
    fail('Legacy round-trip', e.message);
  }

  // Direct data (stats) round-trip
  const stats = { totalArticles: 10, unreadCount: 4, favoriteCount: 1, feedCount: 2, folderCount: 1 };
  const statsWrapped = await wrapHandlerSim(async () => stats)();
  try {
    const s = secureInvokeSim(statsWrapped) as typeof stats;
    if (s.totalArticles === 10 && s.unreadCount === 4) ok('Direct stats round-trip');
    else fail('Stats', JSON.stringify(s));
  } catch (e: any) {
    fail('Stats', e.message);
  }

  // Error path
  const errWrapped = await wrapHandlerSim(async () => {
    throw new Error('boom');
  })();
  try {
    secureInvokeSim(errWrapped);
    fail('Error path', 'should have thrown');
  } catch (e: any) {
    if (e.message === 'boom') ok('Error path throws clean message');
    else fail('Error path', e.message);
  }

  // Broken old logic still fails (regression guard)
  function brokenSecureInvoke(raw: any) {
    if (raw && typeof raw === 'object' && 'error' in raw) {
      if (raw.error) throw new Error(raw.error);
      return raw.data;
    }
    return raw;
  }
  const broken = brokenSecureInvoke({ data: createSuccessResponse([1]) });
  try {
    unwrapOrThrow(broken as any);
    fail('Broken regression', 'should fail');
  } catch {
    ok('Broken pre-fix logic still fails unwrapOrThrow (regression documented)');
  }

  // Live DB path if electron + sqlite available
  console.log('\n📦 Live SQLite / ArticleService (if available)\n');
  try {
    // Electron modules need to run under electron runtime; skip if not
    const isElectron = !!(process.versions as any).electron;
    if (!isElectron) {
      console.log('  ⏭  Not running under Electron — skip live DB (unit envelope tests above still apply)');
      console.log('     Live path is exercised by `quasar dev -m electron` logs + UI.');
    } else {
      const { getArticleService } = await import(
        '../src-electron/infrastructure/di/Container'
      );
      const { SqliteUtil } = await import(
        '../src-electron/infrastructure/persistence/sqlite'
      );
      await SqliteUtil.getInstance().init();
      const svc = getArticleService();
      const folders = await svc.getFolders();
      ok(`Live folders: ${folders.length}`);
      const st = await svc.getStats();
      ok(`Live stats: articles=${st.totalArticles} unread=${st.unreadCount}`);
      if (folders.length) {
        const feeds = await svc.getFeeds(folders[0].name);
        ok(`Live feeds in "${folders[0].name}": ${feeds.length}`);
        if (feeds[0]) {
          const articles = await svc.getArticles({ feedId: feeds[0].id }, 0, 5);
          ok(`Live articles for ${feeds[0].title}: ${articles.articles.length}/${articles.total}`);
          if (articles.articles[0]) {
            const a = await svc.getArticle(articles.articles[0].id);
            if (a?.title) ok(`Live content: "${a.title.slice(0, 50)}"`);
            else fail('Live content', 'empty');
          }
        }
      }
    }
  } catch (e: any) {
    fail('Live DB', e?.message || String(e));
  }

  console.log(`\n════════════════════════════════`);
  console.log(`  Passed: ${passed}  Failed: ${failed}`);
  console.log(`════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
