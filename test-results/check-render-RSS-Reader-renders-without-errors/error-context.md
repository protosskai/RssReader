# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: check-render.spec.ts >> RSS Reader renders without errors
- Location: test/e2e/check-render.spec.ts:3:5

# Error details

```
Error: HTML should contain rendered Vue app

expect(received).toBeGreaterThan(expected)

Expected: > 50000
Received:   21304
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - status [ref=e3]:
    - text: Running in browser preview — feed data requires the Electron desktop app (
    - code [ref=e4]: yarn dev:electron
    - text: ). UI shell still loads for styling checks.
  - generic [ref=e5]:
    - banner [ref=e6]:
      - toolbar [ref=e7]:
        - button "Toggle sidebar" [ref=e8] [cursor=pointer]:
          - img [ref=e10]: menu
        - button "Inkline" [ref=e11] [cursor=pointer]:
          - generic [ref=e13]: Inkline
        - generic [ref=e14]:
          - button "Refresh" [ref=e15] [cursor=pointer]:
            - img [ref=e17]: refresh
          - button "Add" [ref=e18] [cursor=pointer]:
            - img [ref=e20]: add
          - button "Search" [ref=e21] [cursor=pointer]:
            - img [ref=e23]: search
          - button "Favorites" [ref=e24] [cursor=pointer]:
            - img [ref=e26]: star_outline
          - button "Settings" [ref=e27] [cursor=pointer]:
            - img [ref=e29]: settings
          - button "Home" [ref=e30] [cursor=pointer]:
            - img [ref=e32]: home
          - separator [ref=e33]
          - button "Minimize" [ref=e34] [cursor=pointer]:
            - img [ref=e36]: minimize
          - button "Close" [ref=e37] [cursor=pointer]:
            - img [ref=e39]: close
    - complementary [ref=e40]:
      - generic [ref=e41]:
        - generic [ref=e45]:
          - generic [ref=e47]: search
          - textbox [ref=e49]:
            - /placeholder: Search articles…
        - generic [ref=e50]:
          - generic [ref=e51]: Subscriptions
          - generic [ref=e54]:
            - generic [ref=e55]: rss_feed
            - generic [ref=e56]: 暂无订阅源
            - generic [ref=e57]:
              - text: 点击上方
              - strong [ref=e58]: +
              - text: 按钮添加第一个订阅
            - button "添加订阅" [ref=e59] [cursor=pointer]:
              - generic [ref=e60]:
                - img [ref=e61]: add_circle_outline
                - generic [ref=e62]: 添加订阅
    - main "Home" [ref=e64]:
      - generic [ref=e65]:
        - generic [ref=e66]:
          - paragraph [ref=e67]: Desktop RSS
          - heading "Inkline" [level=1] [ref=e68]
          - paragraph [ref=e69]: Scan feeds. Open an article. Read without noise. Return.
        - region "Quick actions" [ref=e70]:
          - button "Add feed" [ref=e71] [cursor=pointer]:
            - generic [ref=e72]:
              - img [ref=e73]: rss_feed
              - generic [ref=e74]: Add feed
          - button "New folder" [ref=e75] [cursor=pointer]:
            - generic [ref=e76]:
              - img [ref=e77]: folder
              - generic [ref=e78]: New folder
          - button "Import OPML" [ref=e79] [cursor=pointer]:
            - generic [ref=e80]:
              - img [ref=e81]: file_upload
              - generic [ref=e82]: Import OPML
          - button "Sync all" [ref=e83] [cursor=pointer]:
            - generic [ref=e84]:
              - img [ref=e85]: sync
              - generic [ref=e86]: Sync all
          - button "Toggle theme" [ref=e87] [cursor=pointer]:
            - img [ref=e89]: dark_mode
          - button "Shortcuts" [ref=e90] [cursor=pointer]:
            - img [ref=e92]: keyboard
          - button "Settings" [ref=e93] [cursor=pointer]:
            - img [ref=e95]: settings
        - generic [ref=e96]:
          - generic [ref=e97]: auto_stories
          - heading "Your reading desk is empty" [level=2] [ref=e98]
          - paragraph [ref=e99]: Add a feed or import an OPML file to start scanning headlines.
          - generic [ref=e100]:
            - button "Add feed" [ref=e101] [cursor=pointer]:
              - generic [ref=e102]:
                - img [ref=e103]: rss_feed
                - generic [ref=e104]: Add feed
            - button "Import OPML" [ref=e105] [cursor=pointer]:
              - generic [ref=e106]:
                - img [ref=e107]: file_upload
                - generic [ref=e108]: Import OPML
          - generic [ref=e109]:
            - paragraph [ref=e110]: Suggested feeds
            - generic [ref=e111]:
              - article [ref=e112]:
                - generic [ref=e113]:
                  - heading "Hacker News" [level=3] [ref=e114]
                  - paragraph [ref=e115]: Tech news & discussion
                - button "Add feed" [ref=e116] [cursor=pointer]:
                  - img [ref=e118]: add
              - article [ref=e119]:
                - generic [ref=e120]:
                  - heading "BBC World" [level=3] [ref=e121]
                  - paragraph [ref=e122]: World headlines
                - button "Add feed" [ref=e123] [cursor=pointer]:
                  - img [ref=e125]: add
              - article [ref=e126]:
                - generic [ref=e127]:
                  - heading "The Verge" [level=3] [ref=e128]
                  - paragraph [ref=e129]: Tech & culture
                - button "Add feed" [ref=e130] [cursor=pointer]:
                  - img [ref=e132]: add
              - article [ref=e133]:
                - generic [ref=e134]:
                  - heading "NPR News" [level=3] [ref=e135]
                  - paragraph [ref=e136]: Public radio news
                - button "Add feed" [ref=e137] [cursor=pointer]:
                  - img [ref=e139]: add
              - article [ref=e140]:
                - generic [ref=e141]:
                  - heading "xkcd" [level=3] [ref=e142]
                  - paragraph [ref=e143]: Webcomic of romance, sarcasm, math
                - button "Add feed" [ref=e144] [cursor=pointer]:
                  - img [ref=e146]: add
              - article [ref=e147]:
                - generic [ref=e148]:
                  - heading "Ars Technica" [level=3] [ref=e149]
                  - paragraph [ref=e150]: Tech policy & analysis
                - button "Add feed" [ref=e151] [cursor=pointer]:
                  - img [ref=e153]: add
        - generic [ref=e154]: j/k list · Enter open · Backspace back · / search
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('RSS Reader renders without errors', async ({ page }) => {
  4  |   const errors: string[] = [];
  5  |   page.on('console', msg => {
  6  |     if (msg.type() === 'error') errors.push(msg.text());
  7  |   });
  8  |   page.on('pageerror', err => errors.push(err.message));
  9  | 
  10 |   await page.goto('http://localhost:9300', { waitUntil: 'domcontentloaded', timeout: 15000 });
  11 |   await page.waitForTimeout(3000);
  12 | 
  13 |   const title = await page.title();
  14 |   const bodyLen = (await page.textContent('body'))?.length || 0;
  15 |   const htmlLen = (await page.content()).length;
  16 | 
  17 |   console.log(`Title: "${title}", Body: ${bodyLen} chars, HTML: ${htmlLen} bytes`);
  18 | 
  19 |   // Must have actual content (a loaded Vue app is >50KB)
> 20 |   expect(htmlLen, 'HTML should contain rendered Vue app').toBeGreaterThan(50000);
     |                                                           ^ Error: HTML should contain rendered Vue app
  21 | 
  22 |   // No Vue errors
  23 |   const vueErrors = errors.filter(e => e.includes('[Vue') || e.includes('Failed to') || e.includes('Cannot find'));
  24 |   expect(vueErrors, 'No Vue/import errors').toHaveLength(0);
  25 | });
  26 | 
```