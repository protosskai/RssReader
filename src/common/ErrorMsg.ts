// ============================================================
//  Comprehensive error handling types and helpers
//  All IPC handlers MUST return ApiResponse<T>
// ============================================================

/**
 * Structured error codes for error classification.
 * Renderers can use these codes for i18n, retry logic, and user-facing messages.
 */
export enum ErrorCode {
  // --- Network errors ---
  /** Request timed out */
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  /** DNS resolution failed */
  NETWORK_DNS_FAILURE = 'NETWORK_DNS_FAILURE',
  /** Server unreachable (connection refused, ENOTFOUND, etc.) */
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  /** Generic HTTP / request failure */
  NETWORK_REQUEST_FAILED = 'NETWORK_REQUEST_FAILED',

  // --- Parse errors ---
  /** Invalid XML in RSS/Atom feed */
  PARSE_INVALID_XML = 'PARSE_INVALID_XML',
  /** Unsupported feed format (not RSS/Atom) */
  PARSE_UNSUPPORTED_FORMAT = 'PARSE_UNSUPPORTED_FORMAT',

  // --- Validation errors ---
  /** URL is malformed or not a valid feed URL */
  VALIDATION_INVALID_URL = 'VALIDATION_INVALID_URL',
  /** Required fields are empty */
  VALIDATION_EMPTY_FIELDS = 'VALIDATION_EMPTY_FIELDS',
  /** Entity already exists (duplicate subscription, folder, etc.) */
  VALIDATION_DUPLICATE = 'VALIDATION_DUPLICATE',
  /** Entity not found (folder, feed, article, etc.) */
  VALIDATION_NOT_FOUND = 'VALIDATION_NOT_FOUND',
  /** Generic validation failure */
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // --- Database errors ---
  /** Generic database error */
  DATABASE_ERROR = 'DATABASE_ERROR',
  /** Database not initialized */
  DATABASE_NOT_INITIALIZED = 'DATABASE_NOT_INITIALIZED',
  /** Database query failed */
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',

  // --- File / IO errors ---
  /** File not found */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  /** File read/write error */
  FILE_IO_ERROR = 'FILE_IO_ERROR',

  // --- Unknown ---
  /** Unclassified / unexpected error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error detail included in every failing API response.
 */
export interface ErrorDetail {
  /** Machine-readable error code from ErrorCode enum or a custom string */
  code: ErrorCode | string;
  /** Human-readable error message (may be shown to user) */
  message: string;
}

/**
 * Successful API response wrapper.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Failed API response wrapper.
 */
export interface ApiErrorResponse {
  success: false;
  error: ErrorDetail;
}

/**
 * The ONE response type every IPC handler must return.
 * Renderers should use `unwrapOrThrow()` to extract `data` on the happy path.
 *
 * @example
 *   const response = await window.electronAPI.getRssInfoListFromDb();
 *   const folders = unwrapOrThrow(response);
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// --- Legacy types retained for backward compatibility ---
// These are still used by storage layer (StorageUtil interface).
// They will be deprecated once storage layer is migrated.

/** @deprecated Use ApiResponse<T> for new code. */
export interface ErrorMsg {
  success: boolean;
  msg: string;
}

/** @deprecated Use ApiResponse<T> for new code. */
export interface ErrorData<T> {
  success: boolean;
  msg: string;
  data: T;
}

// ============================================================
//  Helper functions
// ============================================================

/**
 * Create a success response.
 *
 * @example createSuccessResponse(folderList)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response with a machine-readable code and human message.
 *
 * @example createErrorResponse(ErrorCode.NETWORK_TIMEOUT, 'Feed fetch timed out after 30s')
 */
export function createErrorResponse(
  code: ErrorCode | string,
  message: string,
): ApiErrorResponse {
  return { success: false, error: { code, message } };
}

/**
 * Create a success Response for void-returning operations.
 *
 * @example createVoidSuccessResponse()
 */
export function createVoidSuccessResponse(): ApiSuccessResponse<void> {
  return { success: true, data: undefined };
}

/**
 * Classify a caught error into an ErrorCode + message.
 * Inspects error.message for known patterns (timeout, DNS, XML, DB, etc.).
 *
 * @param error  The raw error caught in a try/catch block.
 * @returns       A { code, message } pair suitable for createErrorResponse().
 */
export function classifyError(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof Error) {
    const msg = error.message;
    const lower = msg.toLowerCase();

    // Network errors
    if (
      lower.includes('timeout') ||
      lower.includes('etimedout') ||
      lower.includes('timed out') ||
      lower.includes('esockettimedout')
    ) {
      return { code: ErrorCode.NETWORK_TIMEOUT, message: msg };
    }
    if (
      lower.includes('enotfound') ||
      lower.includes('getaddrinfo') ||
      lower.includes('dns')
    ) {
      return { code: ErrorCode.NETWORK_DNS_FAILURE, message: msg };
    }
    if (
      lower.includes('econnrefused') ||
      lower.includes('unreachable') ||
      lower.includes('enotconn') ||
      lower.includes('econnreset')
    ) {
      return { code: ErrorCode.NETWORK_UNREACHABLE, message: msg };
    }
    if (
      lower.includes('fetch') ||
      lower.includes('request') ||
      lower.includes('http') ||
      lower.includes('network') ||
      lower.includes('eai_again')
    ) {
      return { code: ErrorCode.NETWORK_REQUEST_FAILED, message: msg };
    }

    // Parse errors
    if (
      lower.includes('invalid xml') ||
      lower.includes('xml parse') ||
      lower.includes('parse error') ||
      lower.includes('malformed')
    ) {
      return { code: ErrorCode.PARSE_INVALID_XML, message: msg };
    }
    if (
      lower.includes('unsupported format') ||
      lower.includes('not a valid feed') ||
      lower.includes('unknown feed')
    ) {
      return { code: ErrorCode.PARSE_UNSUPPORTED_FORMAT, message: msg };
    }

    // Validation errors
    if (lower.includes('invalid url') || lower.includes('invalid uri')) {
      return { code: ErrorCode.VALIDATION_INVALID_URL, message: msg };
    }
    if (lower.includes('empty') || lower.includes('required')) {
      return { code: ErrorCode.VALIDATION_EMPTY_FIELDS, message: msg };
    }
    if (
      lower.includes('not exist') ||
      lower.includes('not found') ||
      lower.includes('不存在')
    ) {
      return { code: ErrorCode.VALIDATION_NOT_FOUND, message: msg };
    }
    if (
      lower.includes('已存在') ||
      lower.includes('already exist') ||
      lower.includes('duplicate')
    ) {
      return { code: ErrorCode.VALIDATION_DUPLICATE, message: msg };
    }

    // Database errors
    if (
      lower.includes('database') ||
      lower.includes('sqlite') ||
      lower.includes('sql_') ||
      lower.includes('sql ')
    ) {
      return { code: ErrorCode.DATABASE_ERROR, message: msg };
    }

    // File errors
    if (lower.includes('enoent') || lower.includes('file not found')) {
      return { code: ErrorCode.FILE_NOT_FOUND, message: msg };
    }
    if (lower.includes('eacces') || lower.includes('eperm')) {
      return { code: ErrorCode.FILE_IO_ERROR, message: msg };
    }

    // Fallback
    return { code: ErrorCode.UNKNOWN_ERROR, message: msg };
  }

  // Non-Error throw (string, number, etc.)
  return { code: ErrorCode.UNKNOWN_ERROR, message: String(error) };
}

/**
 * Unwrap an ApiResponse<T>, throwing a classified Error if the response failed.
 *
 * Use this in stores / renderer code to get back to a throw-based flow
 * that existing try/catch blocks already handle.
 *
 * @example
 *   const response = await window.electronAPI.getRssInfoListFromDb();
 *   const folders = unwrapOrThrow(response);
 *
 * @throws Error with .code property set to the ErrorCode string
 */
export function unwrapOrThrow<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    const err = new Error(response.error.message);
    (err as Error & { code?: string }).code = response.error.code;
    throw err;
  }
  return response.data;
}
