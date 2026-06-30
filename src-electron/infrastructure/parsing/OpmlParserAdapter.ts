import { opmlToJSON } from "opml-to-json";

export interface OpmlOutline {
	text: string;
	title: string;
	type: "rss" | "folder";
	xmlUrl?: string;
	htmlUrl?: string;
	children?: OpmlOutline[];
}

export interface IOpmlParser {
	parse(xml: string): Promise<OpmlOutline[]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flatten(outlines: any[]): OpmlOutline[] {
	const result: OpmlOutline[] = [];
	for (const o of outlines) {
		const xmlUrl = o.xmlurl || o.xmlUrl;
		const item: OpmlOutline = {
			text: o.text || "",
			title: o.title || o.text || "",
			type: xmlUrl ? "rss" : "folder",
			xmlUrl,
			htmlUrl: o.htmlurl || o.htmlUrl,
		};
		if (o.children && o.children.length > 0) {
			item.children = flatten(o.children);
		}
		result.push(item);
	}
	return result;
}

export class OpmlParserAdapter implements IOpmlParser {
	async parse(xml: string): Promise<OpmlOutline[]> {
		const parsed: any = await opmlToJSON(xml);
		if (!parsed?.children || !Array.isArray(parsed.children)) return [];
		return flatten(parsed.children);
	}
}
