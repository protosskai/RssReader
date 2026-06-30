/** Shared types for RSS and OPML parsing */
export interface ParsedFeedItem {
	guid: string;
	title: string;
	link: string;
	content: string;
	description: string;
	author?: string;
	pubDate?: string;
	categories?: string[];
}

export interface ParsedFeed {
	title: string;
	link: string;
	description?: string;
	items: ParsedFeedItem[];
	lastBuildDate?: string;
	language?: string;
}

export interface IRssParser {
	parseUrl(url: string): Promise<ParsedFeed>;
	parseString(xml: string): Promise<ParsedFeed>;
}
