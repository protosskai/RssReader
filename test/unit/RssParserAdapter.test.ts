import { describe, it, expect } from "vitest";
import { RssParserAdapter } from "../../src-electron/infrastructure/parsing/RssParserAdapter";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test feed</description>
    <item>
      <title>Test Article</title>
      <link>https://example.com/1</link>
      <guid>https://example.com/1</guid>
      <description>Article body text</description>
      <author>Test Author</author>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("RssParserAdapter", () => {
	it("正向：解析有效的 RSS XML 返回 ParsedFeed", async () => {
		const adapter = new RssParserAdapter();
		const result = await adapter.parseString(SAMPLE_RSS);
		expect(result.title).toBe("Test Feed");
		expect(result.link).toBe("https://example.com");
		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Test Article");
		expect(result.items[0].link).toBe("https://example.com/1");
	});

	it("边界：空 items 列表返回空数组", async () => {
		const emptyRss =
			'<?xml version="1.0"?><rss version="2.0"><channel><title>E</title><link>https://x.com</link></channel></rss>';
		const adapter = new RssParserAdapter();
		const result = await adapter.parseString(emptyRss);
		expect(result.items).toEqual([]);
	});

	it("异常：无效 XML 抛出错误", async () => {
		const adapter = new RssParserAdapter();
		await expect(adapter.parseString("not valid xml")).rejects.toThrow();
	});

	it("等价类：Atom feed 也能正确解析", async () => {
		const atomFeed = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed</title>
      <link href="https://example.com"/>
      <entry>
        <title>Atom Entry</title>
        <link href="https://example.com/entry"/>
        <id>urn:uuid:123</id>
        <summary>Summary text</summary>
      </entry>
    </feed>`;
		const adapter = new RssParserAdapter();
		const result = await adapter.parseString(atomFeed);
		expect(result.title).toBe("Atom Feed");
		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Atom Entry");
	});
});
