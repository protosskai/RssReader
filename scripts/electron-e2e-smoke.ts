/**
 * Electron end-to-end smoke test.
 * Launches the packaged main process against the Vite dev server,
 * drives the UI via Playwright, and asserts core flows work.
 *
 * Prerequisites: `npx quasar dev -m electron` is NOT required —
 * this script starts Electron itself after ensuring the SPA is up.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/electron-e2e-smoke.ts
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import path from 'path';
import http from 'http';
import { spawn, type ChildProcess } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const APP_URL = process.env.APP_URL || 'http://localhost:9000';
const MAIN_JS = path.join(ROOT, '.quasar/electron/electron-main.js');

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✅ ${label}`);
  passed++;
}
function fail(label: string, reason: string) {
  console.log(`  ❌ ${label}: ${reason}`);
  failed++;
}

async function waitForUrl(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) resolve();
          else reject(new Error(`status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Dev server not ready at ${url}`);
}

async function ensureDevServer(): Promise<ChildProcess | null> {
  try {
    await waitForUrl(APP_URL, 2000);
    console.log('  Dev server already running');
    return null;
  } catch {
    // start quasar spa only (no electron) so we control electron via playwright
  }

  console.log('  Starting quasar SPA dev server…');
  const child = spawn('npx', ['quasar', 'dev'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  child.stdout?.on('data', (d) => {
    const s = String(d);
    if (s.includes('error') || s.includes('ERROR')) process.stdout.write(`[spa] ${s}`);
  });
  child.stderr?.on('data', (d) => process.stderr.write(`[spa-err] ${d}`));
  await waitForUrl(APP_URL, 90000);
  console.log('  Dev server ready');
  return child;
}

async function main() {
  console.log('\n🚀 Electron E2E Smoke Test\n');

  let spa: ChildProcess | null = null;
  let app: ElectronApplication | null = null;

  try {
    spa = await ensureDevServer();

    // Ensure electron main/preload are compiled
    const { execSync } = await import('child_process');
    try {
      execSync('npx quasar prepare', { cwd: ROOT, stdio: 'ignore' });
    } catch {
      /* optional */
    }

    // Build electron artifacts if missing
    const fs = await import('fs');
    if (!fs.existsSync(MAIN_JS)) {
      console.log('  Compiling electron main via quasar…');
      // Trigger a quick electron compile by running build electron prepare
      execSync('npx quasar dev -m electron', {
        cwd: ROOT,
        stdio: 'ignore',
        timeout: 25000,
        env: { ...process.env },
      });
    }

    // Prefer launching via electron binary + main, with APP_URL set
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electronBin = require('electron') as unknown as string;
    const appUrl = process.env.APP_URL || APP_URL;
    console.log(`  Launching Electron: ${electronBin}`);
    console.log(`  Main: ${MAIN_JS}`);
    console.log(`  APP_URL: ${appUrl}`);

    if (!fs.existsSync(MAIN_JS)) {
      fail('compile', `Missing ${MAIN_JS} — run npx quasar dev -m electron once first`);
      process.exit(1);
    }

    app = await electron.launch({
      executablePath: electronBin,
      args: [MAIN_JS],
      env: {
        ...process.env,
        APP_URL: appUrl,
        NODE_ENV: process.env.NODE_ENV || 'development',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
      timeout: 60000,
    });

    const page: Page = await app.firstWindow({ timeout: 45000 });
    page.setDefaultTimeout(20000);

    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Wait for Vue app content to load and mount
    await page.waitForSelector('.ink-home__title', { timeout: 15000 }).catch(() => undefined);
    const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
    console.log(`  Body preview: ${bodyText.slice(0, 120).replace(/\n/g, ' ')}…`);

    // ── S1: App renders, not white screen ──
    console.log('\n📄 S1: 启动渲染');
    if (bodyText.length > 20) ok(`页面有内容 (${bodyText.length} chars)`);
    else fail('页面内容', '疑似白屏');

    if (/RSS|订阅|文件夹|文章|欢迎/i.test(bodyText)) ok('包含应用关键字');
    else fail('应用关键字', bodyText.slice(0, 80));

    // electronAPI present
    const hasApi = await page.evaluate(() => !!(window as any).electronAPI);
    if (hasApi) ok('window.electronAPI 已注入');
    else fail('window.electronAPI', '未注入 — preload 失败');

    // ── S2: IPC load folder list ──
    console.log('\n📄 S2: IPC 数据加载');
    const listResult = await page.evaluate(async () => {
      try {
        const api = (window as any).electronAPI;
        const raw = await api.getRssInfoListFromDb();
        return { ok: true, raw };
      } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
      }
    });

    if (!listResult.ok) {
      fail('getRssInfoListFromDb', listResult.error || 'unknown');
    } else {
      const raw = listResult.raw as any;
      // After secureInvoke fix: should be ApiResponse { success, data }
      if (raw && raw.success === true && Array.isArray(raw.data)) {
        ok(`订阅列表加载成功 (${raw.data.length} 文件夹)`);
      } else if (raw && Array.isArray(raw)) {
        // If somehow fully unwrapped to array
        ok(`订阅列表加载成功 (array ${raw.length})`);
      } else if (raw && raw.data && raw.data.success) {
        fail('IPC 双层包装', JSON.stringify(raw).slice(0, 200));
      } else {
        fail('订阅列表格式', JSON.stringify(raw).slice(0, 200));
      }
    }

    // ── S3: Stats ──
    const statsResult = await page.evaluate(async () => {
      try {
        return { ok: true, stats: await (window as any).electronAPI.getArticleStats() };
      } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
      }
    });
    if (statsResult.ok && statsResult.stats && typeof statsResult.stats.totalArticles === 'number') {
      ok(`文章统计 totalArticles=${statsResult.stats.totalArticles}`);
    } else {
      fail('getArticleStats', statsResult.ok ? JSON.stringify(statsResult.stats) : statsResult.error || '');
    }

    // ── S4: Open first feed if any ──
    console.log('\n📄 S3: 文章列表 & 正文');
    const feedNav = await page.evaluate(async () => {
      try {
        const api = (window as any).electronAPI;
        const list = await api.getRssInfoListFromDb();
        const folders = list?.success ? list.data : list;
        if (!Array.isArray(folders) || folders.length === 0) return { empty: true };
        for (const f of folders) {
          if (f.data && f.data.length > 0) {
            return { empty: false, rssId: f.data[0].id, title: f.data[0].title };
          }
        }
        return { empty: true };
      } catch (e: any) {
        return { error: e?.message || String(e) };
      }
    });

    if (feedNav.error) {
      fail('定位订阅源', feedNav.error);
    } else if (feedNav.empty) {
      ok('无订阅源 — 跳过列表/正文（空状态可接受）');
    } else {
      ok(`找到订阅源: ${feedNav.title}`);

      const posts = await page.evaluate(async (rssId: string) => {
        try {
          const api = (window as any).electronAPI;
          const raw = await api.queryPostIndexByRssId(rssId);
          const list = raw?.success ? raw.data : raw;
          return { ok: true, count: Array.isArray(list) ? list.length : -1, first: Array.isArray(list) ? list[0] : null, rawType: typeof raw, hasSuccess: !!(raw && raw.success) };
        } catch (e: any) {
          return { ok: false, error: e?.message || String(e) };
        }
      }, feedNav.rssId as string);

      if (!posts.ok) fail('queryPostIndexByRssId', (posts as any).error);
      else if ((posts as any).count >= 0) {
        ok(`文章列表 count=${(posts as any).count} (ApiResponse.success=${(posts as any).hasSuccess})`);

        const first = (posts as any).first;
        if (first?.guid) {
          const content = await page.evaluate(async (guid: string) => {
            try {
              const api = (window as any).electronAPI;
              const raw = await api.queryPostContentByGuid(guid);
              const data = raw?.success ? raw.data : raw;
              return {
                ok: true,
                title: data?.title || '',
                contentLen: (data?.content || '').length,
                hasSuccess: !!(raw && raw.success),
              };
            } catch (e: any) {
              return { ok: false, error: e?.message || String(e) };
            }
          }, first.guid as string);

          if (!content.ok) fail('queryPostContentByGuid', (content as any).error);
          else if ((content as any).title) {
            ok(`正文加载: "${(content as any).title.slice(0, 40)}" (${(content as any).contentLen} chars)`);
          } else {
            fail('正文内容', JSON.stringify(content).slice(0, 200));
          }
        } else {
          ok('该源暂无文章 — 跳过正文');
        }
      } else {
        fail('文章列表', JSON.stringify(posts).slice(0, 200));
      }
    }

    // ── S5: Console fatal errors ──
    console.log('\n📄 S4: 控制台致命错误');
    console.log('All console errors captured during test:');
    consoleErrors.forEach((err, idx) => console.log(`  [Error #${idx+1}]`, err));
    
    const fatal = consoleErrors.filter(
      (e) =>
        /Cannot read prop|is not a function|unwrapOrThrow|Electron API is not available|white.?screen/i.test(
          e,
        ),
    );
    if (fatal.length === 0) ok(`无致命控制台错误 (总 console.error: ${consoleErrors.length})`);
    else fail('致命错误', fatal.slice(0, 3).join(' | '));

    await page.screenshot({ path: '/tmp/rss-electron-e2e.png', fullPage: true }).catch(() => undefined);
    console.log('  📸 screenshot: /tmp/rss-electron-e2e.png');
  } catch (e: any) {
    console.error('Fatal:', e?.message || e);
    failed++;
  } finally {
    if (app) await app.close().catch(() => undefined);
    if (spa) {
      spa.kill('SIGTERM');
    }
  }

  console.log(`\n════════════════════════════════`);
  console.log(`  Passed: ${passed}  Failed: ${failed}`);
  console.log(`════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
