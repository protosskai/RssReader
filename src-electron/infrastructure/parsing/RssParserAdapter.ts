import RssParser from "rss-parser";
import type { IRssParser, ParsedFeed, ParsedFeedItem } from "./types";

const parser = new RssParser({
	timeout: 30000,
	headers: { "User-Agent": "RssReader/1.0" },
});

function mapItem(item: RssParser.Item): ParsedFeedItem {
	const contentEncoded =
		typeof (item as Record<string, unknown>)["content:encoded"] === "string"
			? ((item as Record<string, unknown>)["content:encoded"] as string)
			: undefined;
	return {
		guid: item.guid || item.link || "",
		title: item.title || "(no title)",
		link: item.link || "",
		content: contentEncoded || item.content || "",
		description: item.contentSnippet || item.summary || "",
		author: item.creator,
		pubDate: item.isoDate || item.pubDate,
		categories: item.categories || [],
	};
}

export class RssParserAdapter implements IRssParser {
	async parseUrl(url: string): Promise<ParsedFeed> {
		const feed = await parser.parseURL(url);
		return {
			title: feed.title || "Untitled Feed",
			link: feed.link || "",
			description: feed.description || feed.title || "",
			items: (feed.items || []).map(mapItem),
			lastBuildDate: feed.lastBuildDate,
			language: feed.language,
		};
	}

	async parseString(xml: string): Promise<ParsedFeed> {
		const feed = await parser.parseString(xml);
		return {
			title: feed.title || "Untitled Feed",
			link: feed.link || "",
			description: feed.description || feed.title || "",
			items: (feed.items || []).map(mapItem),
			lastBuildDate: feed.lastBuildDate,
		};
	}
}
