import { net } from "electron";
import { cacheManager } from "./CacheManager";
import axios from "axios";

/**
 * Result of fetching a feed URL, including HTTP headers for conditional requests.
 */
export interface FeedFetchResult {
	content: string;
	etag?: string;
	lastModified?: string;
	/** Whether the feed was unchanged (304 Not Modified) — the caller should reuse cached content */
	notModified: boolean;
	/** Detected encoding from Content-Type header */
	encoding?: string;
}

/**
 * Options for feed fetching.
 */
export interface FeedFetchOptions {
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
	/** Whether to use cache (default: true) */
	useCache?: boolean;
	/** Cache expiry in ms (overrides default 5 min) */
	cacheExpiry?: number;
	/** If-None-Match value for conditional requests */
	etag?: string;
	/** If-Modified-Since value for conditional requests */
	lastModified?: string;
	/** Maximum content size in bytes before rejecting (default: 10MB) */
	maxSize?: number;
}

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Extract content encoding from a Content-Type header string.
 * e.g. "text/xml; charset=utf-8" → "utf-8"
 */
const extractEncoding = (contentType?: string): string | undefined => {
	if (!contentType) return undefined;
	const match = contentType.match(/charset=([^;]+)/i);
	if (match) return match[1].trim().toLowerCase();
	// Also try to detect from the mime type itself
	if (contentType.includes("utf-8") || contentType.includes("utf8"))
		return "utf-8";
	if (contentType.includes("gb2312") || contentType.includes("gbk"))
		return "gbk";
	if (contentType.includes("big5")) return "big5";
	if (contentType.includes("shift_jis") || contentType.includes("sjis"))
		return "shift_jis";
	if (contentType.includes("iso-8859-1") || contentType.includes("latin1"))
		return "iso-8859-1";
	return undefined;
};

/**
 * Decode a Buffer to string using detected or specified encoding.
 * Falls back through common encodings when the primary fails.
 */
const decodeContent = (buffer: Buffer, primaryEncoding?: string): string => {
	const encodings: string[] = [];
	if (primaryEncoding && primaryEncoding !== "utf-8") {
		encodings.push(primaryEncoding);
	}
	encodings.push("utf-8");
	// Fallback encodings for common non-UTF-8 feeds
	encodings.push("gbk", "gb2312", "big5", "shift_jis", "iso-8859-1", "latin1");

	// For utf-8, do a quick validity check
	if (!primaryEncoding || primaryEncoding === "utf-8") {
		try {
			const str = buffer.toString("utf-8");
			return str;
		} catch {
			// Fall through to try other encodings
		}
	}

	for (const enc of encodings) {
		try {
			const str = buffer.toString(enc as BufferEncoding);
			return str;
		} catch {}
	}
	// Last resort
	return buffer.toString("utf-8");
};

/**
 * Fetch URL content with timeout, size limits, ETag/Last-Modified support,
 * and proper encoding handling.
 */
export const getUrl = async (
	url: string,
	optionsOrUseCache?: boolean | FeedFetchOptions,
	cacheExpiry?: number,
): Promise<string> => {
	// Backward compat: accept boolean as second arg
	let opts: FeedFetchOptions;
	if (typeof optionsOrUseCache === "boolean") {
		opts = { useCache: optionsOrUseCache, cacheExpiry };
	} else {
		opts = optionsOrUseCache || {};
	}

	const {
		timeout = DEFAULT_TIMEOUT,
		useCache = true,
		cacheExpiry: expiry,
		etag: ifNoneMatch,
		lastModified: ifModifiedSince,
		maxSize = DEFAULT_MAX_SIZE,
	} = opts;

	const timestamp = new Date().toISOString();
	const log = (msg: string) =>
		console.log(`[${timestamp}] [NetUtil.ts] ${msg}`);
	const logError = (msg: string) =>
		console.error(`[${timestamp}] [NetUtil.ts] ${msg}`);

	log(`getUrl called for: ${url}`);
	log(
		`Options: timeout=${timeout}ms, maxSize=${maxSize}, useCache=${useCache}, etag=${ifNoneMatch || "none"}, lastModified=${ifModifiedSince || "none"}`,
	);

	// Check cache first (only when not doing a conditional request)
	if (useCache && !ifNoneMatch && !ifModifiedSince) {
		const cachedData = cacheManager.get(url);
		if (cachedData) {
			log(`Cache hit for: ${url}`);
			return cachedData;
		}
		log(`Cache miss, will fetch from network`);
	}

	const fetchWithAxios = async (): Promise<string> => {
		const headers: Record<string, string> = {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		};
		if (ifNoneMatch) {
			headers["If-None-Match"] = ifNoneMatch;
		}
		if (ifModifiedSince) {
			headers["If-Modified-Since"] = ifModifiedSince;
		}

		const response = await axios.get<string>(url, {
			timeout,
			responseType: "text",
			headers,
			validateStatus: (status) =>
				(status >= 200 && status < 300) || status === 304,
			transformResponse: [(data) => data], // raw data, no automatic JSON parse
		});

		if (response.status === 304) {
			// Not modified — caller should use cached content
			return ""; // signal via empty string (backward compat: caller checks at higher level)
		}

		const rawData = response.data;
		if (typeof rawData !== "string") {
			throw new Error("Unexpected response type");
		}

		// Check size before decoding
		if (Buffer.byteLength(rawData, "utf-8") > maxSize) {
			throw new Error(
				`Feed content exceeds maximum size of ${maxSize / 1024 / 1024}MB: ${url}`,
			);
		}

		return rawData;
	};

	// Try Electron net first, fall back to axios
	if (!net || typeof net.request !== "function") {
		log("Electron net is unavailable, falling back to axios");
		const result = await fetchWithAxios();
		if (result && useCache) {
			cacheManager.set(url, result, expiry);
		}
		return result;
	}

	// Electron net.request path with full timeout + size limit
	return new Promise<string>((resolve, reject) => {
		const request = net.request({
			url,
			// Electron-specific: don't follow redirects (let caller handle)
		});
		request.setHeader(
			"User-Agent",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		);

		if (ifNoneMatch) {
			request.setHeader("If-None-Match", ifNoneMatch);
		}
		if (ifModifiedSince) {
			request.setHeader("If-Modified-Since", ifModifiedSince);
		}

		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let rejected = false;

		const doReject = (message: string) => {
			if (rejected) return;
			rejected = true;
			if (timeoutId) clearTimeout(timeoutId);
			logError(message);
			reject(new Error(message));
		};

		timeoutId = setTimeout(() => {
			doReject(`Request timeout after ${timeout}ms: ${url}`);
			try {
				request.abort();
			} catch {
				/* ignore */
			}
		}, timeout);

		request.on("response", (response) => {
			if (timeoutId) clearTimeout(timeoutId);

			const statusCode = response.statusCode;
			const contentType =
				(response.headers["content-type"] as string) || undefined;
			const encoding = extractEncoding(contentType);
			log(
				`Response status: ${statusCode}, content-type: ${contentType || "unknown"}, encoding: ${encoding || "unknown"}`,
			);

			if (statusCode === 304) {
				// Not modified — return empty content; caller checks at higher level
				log(`304 Not Modified for: ${url}`);
				resolve("");
				return;
			}

			if (statusCode < 200 || statusCode >= 300) {
				doReject(`HTTP error! Status: ${statusCode}`);
				return;
			}

			// Check Content-Length header for size limit
			const contentLengthStr = response.headers["content-length"] as
				| string
				| undefined;
			if (contentLengthStr) {
				const contentLength = parseInt(contentLengthStr, 10);
				if (!isNaN(contentLength) && contentLength > maxSize) {
					doReject(
						`Feed content size ${contentLength} exceeds maximum ${maxSize} bytes: ${url}`,
					);
					try {
						request.abort();
					} catch {
						/* ignore */
					}
					return;
				}
			}

			const chunks: Buffer[] = [];
			let totalSize = 0;

			response.on("data", (data) => {
				const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
				chunks.push(chunk);
				totalSize += chunk.length;

				// Size check during streaming (defense-in-depth, for feeds without Content-Length)
				if (totalSize > maxSize) {
					doReject(
						`Feed content exceeds maximum size of ${maxSize} bytes during download: ${url}`,
					);
					try {
						request.abort();
					} catch {
						/* ignore */
					}
				}
			});

			response.on("end", () => {
				if (rejected) return;
				try {
					const resultBuffer = Buffer.concat(chunks, totalSize);
					const result = decodeContent(resultBuffer, encoding);
					log(
						`Response processed: ${totalSize} bytes → ${result.length} chars`,
					);

					if (useCache) {
						cacheManager.set(url, result, expiry);
					}

					resolve(result);
				} catch (error) {
					doReject(
						`Failed to process response: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			});

			response.on("error", (error: Error) => {
				doReject(`Response error: ${error.message}`);
			});

			response.on("aborted", () => {
				if (!rejected) {
					doReject(`Response aborted for URL: ${url}`);
				}
			});
		});

		request.on("error", (error) => {
			doReject(`Request error: ${error.message}`);
		});

		log("Sending request...");
		request.end();
	});
};

/**
 * Fetch URL with full metadata, including ETag/Last-Modified for conditional requests.
 * Use this when you need to track feed update status.
 */
export const getUrlWithMeta = async (
	url: string,
	opts?: FeedFetchOptions,
): Promise<FeedFetchResult> => {
	const {
		timeout = DEFAULT_TIMEOUT,
		useCache = true,
		cacheExpiry: expiry,
		etag: ifNoneMatch,
		lastModified: ifModifiedSince,
		maxSize = DEFAULT_MAX_SIZE,
	} = opts || {};

	const timestamp = new Date().toISOString();
	const log = (msg: string) =>
		console.log(`[${timestamp}] [NetUtil.ts] ${msg}`);
	const logError = (msg: string) =>
		console.error(`[${timestamp}] [NetUtil.ts] ${msg}`);

	const headers: Record<string, string> = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	};
	if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
	if (ifModifiedSince) headers["If-Modified-Since"] = ifModifiedSince;

	log(`getUrlWithMeta: ${url}`);

	try {
		const response = await axios.get(url, {
			timeout,
			responseType: "arraybuffer",
			headers,
			validateStatus: (status) =>
				(status >= 200 && status < 300) || status === 304,
			maxContentLength: maxSize,
			maxBodyLength: maxSize,
		});

		const resHeaders = response.headers as Record<
			string,
			string | string[] | undefined
		>;
		const getHeader = (name: string): string | undefined => {
			const val = resHeaders[name.toLowerCase()];
			if (Array.isArray(val)) return val[0];
			return val;
		};

		const etag = getHeader("etag");
		const lastModified = getHeader("last-modified");
		const contentType = getHeader("content-type");
		const encoding = extractEncoding(contentType);

		if (response.status === 304) {
			return {
				content: "",
				etag,
				lastModified,
				notModified: true,
				encoding,
			};
		}

		const buffer = Buffer.from(response.data);
		const content = decodeContent(buffer, encoding);
		log(
			`Fetched: ${buffer.length} bytes → ${content.length} chars, encoding: ${encoding || "unknown"}`,
		);

		if (useCache) {
			cacheManager.set(url, content, expiry);
			if (etag) cacheManager.setEtag(url, etag);
			if (lastModified) cacheManager.setLastModified(url, lastModified);
		}

		return {
			content,
			etag,
			lastModified,
			notModified: false,
			encoding,
		};
	} catch (error) {
		// Re-throw with context
		if (axios.isAxiosError(error)) {
			if (error.code === "ECONNABORTED") {
				throw new Error(`Request timeout after ${timeout}ms: ${url}`);
			}
			if (error.response?.status === 304) {
				return {
					content: "",
					notModified: true,
				};
			}
			throw new Error(
				`HTTP ${error.response?.status}: ${url} — ${error.message}`,
			);
		}
		throw error;
	}
};

// Legacy export for backward compat
export { getUrl as getUrlCompat };
