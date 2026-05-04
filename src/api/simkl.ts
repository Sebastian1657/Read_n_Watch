const SIMKL_BASE_URL = "https://api.simkl.com";
const SIMKL_API_VERSION = "2";

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRY_COUNT = 2;

type SimklPrimitive = string | number | boolean | null | undefined;
type SimklQueryValue = SimklPrimitive | SimklPrimitive[];

export type SimklQueryParams = Record<string, SimklQueryValue>;

export interface SimklIds {
  simkl?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  [key: string]: unknown;
}

export interface SimklMedia {
  title?: string;
  year?: number;
  type?: "movie" | "show" | "anime" | string;
  ids?: SimklIds;
  poster?: string;
  fanart?: string;
  [key: string]: unknown;
}

export interface SimklSearchMovieResult {
  type?: string;
  score?: number;
  movie?: SimklMedia;
  [key: string]: unknown;
}

export interface SimklPagination {
  page?: number;
  limit?: number;
  pageCount?: number;
  itemCount?: number;
  hasNextPage?: boolean;
}

export interface SimklResponse<T> {
  data: T;
  status: number;
  pagination?: SimklPagination;
}

export interface SimklRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: SimklQueryParams;
  body?: unknown;
  accessToken?: string;
  timeoutMs?: number;
  retryCount?: number;
}

export class SimklApiError extends Error {
  status: number;
  details: unknown;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    details?: unknown,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SimklApiError";
    this.status = status;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const simklApiKey = process.env.EXPO_PUBLIC_SIMKL_API_KEY ?? "";

if (!simklApiKey) {
  throw new Error("Missing EXPO_PUBLIC_SIMKL_API_KEY environment variable.");
}

function buildQueryString(query?: SimklQueryParams): string {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      continue;
    }

    params.append(key, String(rawValue));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function parsePagination(headers: Headers): SimklPagination | undefined {
  const page = headers.get("x-pagination-page");
  const limit = headers.get("x-pagination-limit");
  const pageCount = headers.get("x-pagination-page-count");
  const itemCount = headers.get("x-pagination-item-count");

  if (!page && !limit && !pageCount && !itemCount) {
    return undefined;
  }

  const parsedPage = page ? Number(page) : undefined;
  const parsedLimit = limit ? Number(limit) : undefined;
  const parsedPageCount = pageCount ? Number(pageCount) : undefined;
  const parsedItemCount = itemCount ? Number(itemCount) : undefined;

  return {
    page: Number.isNaN(parsedPage) ? undefined : parsedPage,
    limit: Number.isNaN(parsedLimit) ? undefined : parsedLimit,
    pageCount: Number.isNaN(parsedPageCount) ? undefined : parsedPageCount,
    itemCount: Number.isNaN(parsedItemCount) ? undefined : parsedItemCount,
    hasNextPage:
      parsedPage !== undefined &&
      parsedPageCount !== undefined &&
      !Number.isNaN(parsedPage) &&
      !Number.isNaN(parsedPageCount)
        ? parsedPage < parsedPageCount
        : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetry(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function getBackoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  const base = 400;
  return base * Math.pow(2, attempt);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

export async function simklRequest<T>(
  path: string,
  options: SimklRequestOptions = {},
): Promise<SimklResponse<T>> {
  const {
    method = "GET",
    query,
    body,
    accessToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryCount = DEFAULT_RETRY_COUNT,
  } = options;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${SIMKL_BASE_URL}${normalizedPath}${buildQueryString(query)}`;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "simkl-api-key": simklApiKey,
          "simkl-api-version": SIMKL_API_VERSION,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      clearTimeout(timeout);

      const payload = await parseResponseBody(response);
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader
        ? Number(retryAfterHeader)
        : undefined;

      if (!response.ok) {
        const errorMessage =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload
            ? String(
                (payload as { message?: unknown }).message ??
                  "Simkl request failed",
              )
            : `Simkl request failed with status ${response.status}`;

        if (attempt < retryCount && shouldRetry(response.status)) {
          await sleep(
            getBackoffMs(
              attempt,
              Number.isNaN(retryAfterSeconds) ? undefined : retryAfterSeconds,
            ),
          );
          continue;
        }

        throw new SimklApiError(
          errorMessage,
          response.status,
          payload,
          Number.isNaN(retryAfterSeconds) ? undefined : retryAfterSeconds,
        );
      }

      return {
        data: payload as T,
        status: response.status,
        pagination: parsePagination(response.headers),
      };
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof SimklApiError) {
        throw error;
      }

      const isAbort = error instanceof Error && error.name === "AbortError";
      const status = isAbort ? 408 : 0;
      const message = isAbort
        ? "Simkl request timeout"
        : "Simkl network request failed";

      if (attempt < retryCount) {
        await sleep(getBackoffMs(attempt));
        continue;
      }

      throw new SimklApiError(message, status, error);
    }
  }

  throw new SimklApiError("Unexpected Simkl request failure", 0);
}

export async function getTrendingMovies(params?: {
  page?: number;
  limit?: number;
  date_from?: string;
  extended?: "full" | string;
}): Promise<SimklResponse<SimklMedia[]>> {
  return simklRequest<SimklMedia[]>("/movies/trending", {
    query: params,
  });
}

export async function searchMovies(
  query: string,
  params?: {
    page?: number;
    limit?: number;
    extended?: "full" | string;
  },
): Promise<SimklResponse<SimklSearchMovieResult[]>> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("searchMovies requires a non-empty query.");
  }

  return simklRequest<SimklSearchMovieResult[]>("/search/movie", {
    query: {
      q: normalizedQuery,
      ...params,
    },
  });
}

export async function getMovieDetails(
  simklId: number | string,
  params?: {
    extended?: "full" | string;
  },
): Promise<SimklResponse<SimklMedia>> {
  return simklRequest<SimklMedia>(`/movies/${simklId}`, {
    query: params,
  });
}

export const simklApi = {
  request: simklRequest,
  getTrendingMovies,
  searchMovies,
  getMovieDetails,
};
