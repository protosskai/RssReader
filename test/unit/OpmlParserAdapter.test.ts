import { describe, it, expect } from "vitest";
import { OpmlParserAdapter } from "../../src-electron/infrastructure/parsing/OpmlParserAdapter";

const SAMPLE_OPML = `<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Test OPML</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline text="Hacker News" title="Hacker News" type="rss"
               xmlUrl="https://hnrss.org/frontpage" htmlUrl="https://news.ycombinator.com"/>
    </outline>
    <outline text="xkcd" title="xkcd" type="rss"
             xmlUrl="https://xkcd.com/atom.xml"/>
  </body>
</opml>`;

describe("OpmlParserAdapter", () => {
	it("正向：解析有效 OPML 返回正确的文件夹和源结构", async () => {
		const adapter = new OpmlParserAdapter();
		const result = await adapter.parse(SAMPLE_OPML);
		expect(result).toHaveLength(2);
		expect(result[0].text).toBe("Tech");
		expect(result[0].type).toBe("folder");
		expect(result[0].children).toHaveLength(1);
		expect(result[0].children![0].text).toBe("Hacker News");
		expect(result[0].children![0].xmlUrl).toBe("https://hnrss.org/frontpage");
		expect(result[1].text).toBe("xkcd");
		expect(result[1].type).toBe("rss");
		expect(result[1].xmlUrl).toBe("https://xkcd.com/atom.xml");
	});

	it("边界：空 body 返回空数组", async () => {
		const empty =
			'<?xml version="1.0"?><opml version="2.0"><head/><body/></opml>';
		const adapter = new OpmlParserAdapter();
		const result = await adapter.parse(empty);
		expect(result).toEqual([]);
	});

	it("异常：无效 XML 抛出错误", async () => {
		const adapter = new OpmlParserAdapter();
		await expect(adapter.parse("garbage")).rejects.toThrow();
	});
});
