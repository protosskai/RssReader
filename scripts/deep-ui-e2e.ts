/**
 * Deeper UI e2e: click through shell, open feed, open article, back, settings, fav.
 */
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(__dirname, '..');
const APP_URL = process.env.APP_URL || 'http://localhost:9300';
const MAIN_JS = path.join(ROOT, '.quasar/electron/electron-main.js');

let passed = 0;
let failed = 0;
const errors: string[] = [];
function ok(m: string) {
  console.log('  ✅', m);
  passed++;
}
function fail(m: string, d: string) {
  console.log('  ❌', m + ':', d);
  failed++;
}

async function resolveAppPage(app: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      const url = w.url();
      if (/devtools:/i.test(url)) continue;
      if (url.includes('localhost') || url.includes('9300') || url.includes('9000')) return w;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return app.firstWindow({ timeout: 5000 });
}

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electronBin = require('electron') as unknown as string;
  const userDataDir = path.join(ROOT, '.qa-userdata-deep');
  fs.mkdirSync(userDataDir, { recursive: true });
  const app = await electron.launch({
    executablePath: electronBin,
    args: [MAIN_JS, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      APP_URL,
      NODE_ENV: 'development',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      QUASAR_ELECTRON_PRELOAD: 'electron-preload.js',
    },
    timeout: 60000,
  });
  const page = await resolveAppPage(app);
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('[console] ' + msg.text());
  });

  for (let i = 0; i < 40; i++) {
    const ready = await page.evaluate(() => !!(window as any).electronAPI).catch(() => false);
    const t = (await page.locator('body').innerText().catch(() => '')) || '';
    if (ready && /Inkline|Feeds|Scan feeds/i.test(t)) break;
    await page.waitForTimeout(400);
  }

  const body = (await page.locator('body').innerText()) || '';
  if (body.length > 50 && /Inkline/i.test(body)) ok('shell renders Inkline');
  else fail('shell', body.slice(0, 120));

  const apiKeys = await page.evaluate(() => Object.keys((window as any).electronAPI || {}));
  if (apiKeys.includes('setReadStatus') && apiKeys.includes('queryPostContentByGuid')) {
    ok('API has setReadStatus + content');
  } else fail('API methods', apiKeys.join(','));

  const seed = await page.evaluate(async () => {
    const api = (window as any).electronAPI;
    const list = await api.getRssInfoListFromDb();
    const folders = list?.success ? list.data : list;
    for (const f of folders || []) {
      if (f.data?.[0]) {
        const postsRaw = await api.queryPostIndexByRssId(f.data[0].id);
        const posts = postsRaw?.success ? postsRaw.data : postsRaw;
        return {
          rssId: f.data[0].id as string,
          title: f.data[0].title as string,
          guid: posts?.[0]?.guid as string | undefined,
          postTitle: posts?.[0]?.title as string | undefined,
        };
      }
    }
    return null;
  });
  if (!seed?.guid) {
    fail('seed', 'no feed/post');
    await app.close();
    process.exit(1);
  }
  ok(`seed ${seed.title}`);

  await page.locator('button[aria-label="Home"]').click().catch(() => undefined);
  await page.waitForTimeout(500);

  await page.evaluate((id: string) => {
    location.hash = `#/postList/${id}`;
  }, seed.rssId);
  await page.waitForTimeout(2000);
  let t = (await page.locator('body').innerText()) || '';
  if (/Mark all|articles|Read|Loading/i.test(t)) ok('post list UI');
  else fail('post list UI', t.slice(0, 150));

  await page.evaluate(
    ({ rssId, postId }: { rssId: string; postId: string }) => {
      location.hash = `#/content?rssId=${encodeURIComponent(rssId)}&postId=${encodeURIComponent(postId)}`;
    },
    { rssId: seed.rssId, postId: seed.guid },
  );
  await page.waitForTimeout(2500);
  t = (await page.locator('body').innerText()) || '';
  const contentOk = !/Couldn.t load article|加载失败|无效的文章/i.test(t) && t.length > 80;
  if (contentOk) ok('article content UI: ' + (seed.postTitle || '').slice(0, 40));
  else fail('article content UI', t.slice(0, 200));

  const readState = await page.evaluate(async (guid: string) => {
    const api = (window as any).electronAPI;
    await api.setReadStatus(guid, true);
    await api.setReadStatus(guid, true);
    const raw = await api.queryPostContentByGuid(guid);
    const data = raw?.success ? raw.data : raw;
    return { read: data?.read, title: data?.title };
  }, seed.guid);
  if (readState.read === 1 || readState.read === true) ok('setReadStatus leaves article read');
  else fail('setReadStatus', JSON.stringify(readState));

  await page.locator('button[aria-label="Back"]').click().catch(async () => {
    await page.evaluate(() => {
      location.hash = '#/';
    });
  });
  await page.waitForTimeout(1000);

  await page.locator('button[aria-label="Settings"]').click();
  await page.waitForTimeout(1200);
  t = (await page.locator('body').innerText()) || '';
  if (/Settings|General|Sync|Appearance/i.test(t)) ok('settings via toolbar');
  else fail('settings UI', t.slice(0, 120));

  await page.locator('button[aria-label="Favorites"]').click();
  await page.waitForTimeout(1200);
  t = (await page.locator('body').innerText()) || '';
  if (/Favorites|No favorites|Library/i.test(t)) ok('favorites via toolbar');
  else fail('favorites UI', t.slice(0, 120));

  const fatal = errors.filter((e) =>
    /Cannot read|is not a function|Pinia|getCurrentInstance|unwrapOrThrow|Electron API is not available|setReadStatus is not a function/i.test(
      e,
    ),
  );
  if (fatal.length === 0) ok(`no fatal console (${errors.length} errors total)`);
  else fail('fatal console', fatal.slice(0, 3).join(' | '));

  if (errors.length) {
    console.log('\n  --- console sample ---');
    errors.slice(0, 20).forEach((e) => console.log('  ·', e.slice(0, 180)));
  }

  await page
    .screenshot({ path: path.join(ROOT, 'docs/deep-ui-shell.png'), fullPage: true })
    .catch(() => undefined);
  await app.close();
  console.log(`\n  Passed: ${passed}  Failed: ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
