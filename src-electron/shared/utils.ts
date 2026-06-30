import { v4 as uuidv4 } from "uuid";

export const getRssId = () => {
	const rssId = uuidv4();
	return String(rssId);
};

export const buildAvatarUrl = (htmlUrl: string): string => {
	try {
		const urlObj = new URL(htmlUrl);
		return `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
	} catch {
		return "";
	}
};
