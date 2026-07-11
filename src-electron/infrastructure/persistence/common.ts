/**
 * Storage layer types — re-exports shared types and defines the StorageUtil interface.
 *
 * Shared types (PostIndexItem, SearchOptions, etc.) live in src/common/models.ts.
 * The StorageUtil interface stays here because it references runtime modules.
 */

// Canonical types live in src/common/models.ts — re-export for legacy importers.
// New code should import directly from 'src/common/models'.
import type {
	PostIndexItem,
	SearchOptions,
	RssFolderItem,
	PostInfoItem,
	ContentInfo,
} from "src/common/models";
import type { ErrorData, ErrorMsg } from "src/common/ErrorMsg";

// Re-export shared types for backward compatibility
export type {
	PostIndexItem,
	SearchOptions,
	RssFolderItem,
	PostInfoItem,
	ContentInfo,
};

export interface StorageUtil {
	dumpFolderItemList: (folderInfoList: RssFolderItem[]) => Promise<ErrorMsg>;
	loadFolderItemList: () => Promise<ErrorData<RssFolderItem[]>>;
	init: () => void;
	syncRssPostList: (
		rssId: string,
		postInfoItemList: PostInfoItem[],
	) => Promise<ErrorData<number>>;
	queryPostContentByGuid: (guid: string) => Promise<ErrorData<ContentInfo>>;
	queryPostIndexByRssId: (rssId: string) => Promise<ErrorData<PostIndexItem[]>>;
	searchPosts: (
		query: string,
		options?: SearchOptions,
	) => Promise<ErrorData<PostIndexItem[]>>;
}
