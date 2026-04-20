const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1";

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_LANG = "pl";

type Primitive = string | number | boolean | null | undefined;
type QueryValue = Primitive | Primitive[];
type QueryParams = Record<string, QueryValue>;

type GoogleBooksOrderBy = "relevance" | "newest";

interface GoogleBooksImageLinks {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
}

interface GoogleBooksIndustryIdentifier {
  type?: string;
  identifier?: string;
}

interface GoogleBooksVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  language?: string;
  imageLinks?: GoogleBooksImageLinks;
  previewLink?: string;
  infoLink?: string;
  industryIdentifiers?: GoogleBooksIndustryIdentifier[];
}

interface GoogleBooksRawVolume {
  id?: string;
  etag?: string;
  selfLink?: string;
  volumeInfo?: GoogleBooksVolumeInfo;
}

interface GoogleBooksVolumesResponse {
  totalItems?: number;
  items?: GoogleBooksRawVolume[];
}

export interface BookItem {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  year?: number;
  description?: string;
  pageCount?: number;
  categories: string[];
  averageRating?: number;
  ratingsCount?: number;
  language?: string;
  smallThumbnail?: string;
  thumbnail?: string;
  coverUrl?: string;
  previewLink?: string;
  infoLink?: string;
  isbn10?: string;
  isbn13?: string;
}

export interface BooksPagination {
  startIndex: number;
  maxResults: number;
  totalItems: number;
  hasNextPage: boolean;
}

export interface BooksServiceResponse<T> {
  data: T;
  status: number;
  pagination?: BooksPagination;
}

export interface BooksSearchOptions {
  startIndex?: number;
  maxResults?: number;
  orderBy?: GoogleBooksOrderBy;
  langRestrict?: string;
  printType?: "all" | "books" | "magazines";
}

export interface BooksAdvancedFilters {
  freeText?: string;
  title?: string;
  author?: string;
  subject?: string;
  publisher?: string;
  isbn?: string;
}

export interface TrendingBooksOptions extends BooksSearchOptions {
  subject?: string;
}

export class BooksApiError extends Error {
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
    this.name = "BooksApiError";
    this.status = status;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const googleBooksApiKey = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY ?? "";

if (!googleBooksApiKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY environment variable.",
  );
}

function normalizeImageUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.startsWith("http://") ? url.replace("http://", "https://") : url;
}

function extractYear(publishedDate?: string): number | undefined {
  if (!publishedDate) {
    return undefined;
  }

  const match = publishedDate.match(/^(\d{4})/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  return Number.isNaN(year) ? undefined : year;
}

function extractIsbn(identifiers?: GoogleBooksIndustryIdentifier[]): {
  isbn10?: string;
  isbn13?: string;
} {
  let isbn10: string | undefined;
  let isbn13: string | undefined;

  if (!identifiers) {
    return { isbn10, isbn13 };
  }

  for (const id of identifiers) {
    if (!id?.identifier || !id.type) {
      continue;
    }

    if (id.type === "ISBN_10") {
      isbn10 = id.identifier;
    }

    if (id.type === "ISBN_13") {
      isbn13 = id.identifier;
    }
  }

  return { isbn10, isbn13 };
}

function mapVolumeToBook(volume: GoogleBooksRawVolume): BookItem | null {
  const id = typeof volume.id === "string" ? volume.id : undefined;
  const info = volume.volumeInfo;

  if (!id || !info?.title) {
    return null;
  }

  const imageLinks = info.imageLinks;
  const thumbnail = normalizeImageUrl(imageLinks?.thumbnail);
  const smallThumbnail = normalizeImageUrl(imageLinks?.smallThumbnail);
  const coverUrl =
    normalizeImageUrl(imageLinks?.medium) ||
    normalizeImageUrl(imageLinks?.large) ||
    normalizeImageUrl(imageLinks?.small) ||
    thumbnail ||
    smallThumbnail;

  const { isbn10, isbn13 } = extractIsbn(info.industryIdentifiers);

  return {
    id,
    title: info.title,
    subtitle: info.subtitle,
    authors: Array.isArray(info.authors) ? info.authors : [],
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    year: extractYear(info.publishedDate),
    description: info.description,
    pageCount: info.pageCount,
    categories: Array.isArray(info.categories) ? info.categories : [],
    averageRating: info.averageRating,
    ratingsCount: info.ratingsCount,
    language: info.language,
    smallThumbnail,
    thumbnail,
    coverUrl,
    previewLink: info.previewLink,
    infoLink: info.infoLink,
    isbn10,
    isbn13,
  };
}

function buildQueryString(query?: QueryParams): string {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  const base = 400;
  return base * 2 ** attempt;
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

function parseApiErrorMessage(payload: unknown, status: number): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "object" &&
    (payload as { error?: unknown }).error !== null
  ) {
    const googleError = (payload as { error: { message?: unknown } }).error;
    if (typeof googleError.message === "string") {
      return googleError.message;
    }
  }

  return `Google Books request failed with status ${status}`;
}

async function booksRequest<T>(
  path: string,
  query?: QueryParams,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryCount = DEFAULT_RETRY_COUNT,
): Promise<BooksServiceResponse<T>> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${GOOGLE_BOOKS_BASE_URL}${normalizedPath}${buildQueryString({
    ...query,
    key: googleBooksApiKey,
  })}`;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeout);

      const payload = await parseResponseBody(response);
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader
        ? Number(retryAfterHeader)
        : undefined;

      if (!response.ok) {
        if (attempt < retryCount && shouldRetry(response.status)) {
          await sleep(
            getBackoffMs(
              attempt,
              Number.isNaN(retryAfterSeconds) ? undefined : retryAfterSeconds,
            ),
          );
          continue;
        }

        throw new BooksApiError(
          parseApiErrorMessage(payload, response.status),
          response.status,
          payload,
          Number.isNaN(retryAfterSeconds) ? undefined : retryAfterSeconds,
        );
      }

      return {
        data: payload as T,
        status: response.status,
      };
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof BooksApiError) {
        throw error;
      }

      const isAbort = error instanceof Error && error.name === "AbortError";
      const status = isAbort ? 408 : 0;
      const message = isAbort
        ? "Google Books request timeout"
        : "Google Books network request failed";

      if (attempt < retryCount) {
        await sleep(getBackoffMs(attempt));
        continue;
      }

      throw new BooksApiError(message, status, error);
    }
  }

  throw new BooksApiError("Unexpected Google Books request failure", 0);
}

function createPagination(
  totalItems: number,
  startIndex: number,
  maxResults: number,
): BooksPagination {
  return {
    totalItems,
    startIndex,
    maxResults,
    hasNextPage: startIndex + maxResults < totalItems,
  };
}

function normalizeSearchOptions(
  options?: BooksSearchOptions,
): Required<BooksSearchOptions> {
  return {
    startIndex: Math.max(options?.startIndex ?? 0, 0),
    maxResults: Math.min(Math.max(options?.maxResults ?? 20, 1), 40),
    orderBy: options?.orderBy ?? "relevance",
    langRestrict: options?.langRestrict ?? DEFAULT_LANG,
    printType: options?.printType ?? "books",
  };
}

function buildAdvancedQuery(filters: BooksAdvancedFilters): string {
  const parts: string[] = [];

  if (filters.isbn) {
    parts.push(`isbn:${filters.isbn.trim()}`);
  }

  if (filters.title) {
    parts.push(`intitle:${filters.title.trim()}`);
  }

  if (filters.author) {
    parts.push(`inauthor:${filters.author.trim()}`);
  }

  if (filters.subject) {
    parts.push(`subject:${filters.subject.trim()}`);
  }

  if (filters.publisher) {
    parts.push(`inpublisher:${filters.publisher.trim()}`);
  }

  if (filters.freeText) {
    parts.push(filters.freeText.trim());
  }

  const query = parts.filter(Boolean).join(" ").trim();

  if (!query) {
    throw new Error(
      "searchBooksAdvanced requires at least one non-empty filter.",
    );
  }

  return query;
}

function mapVolumesResponse(
  raw: GoogleBooksVolumesResponse,
  options: Required<BooksSearchOptions>,
): BooksServiceResponse<BookItem[]> {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const books = items
    .map((volume) => mapVolumeToBook(volume))
    .filter((book): book is BookItem => book !== null);
  const totalItems =
    typeof raw.totalItems === "number" ? raw.totalItems : books.length;

  return {
    data: books,
    status: 200,
    pagination: createPagination(
      totalItems,
      options.startIndex,
      options.maxResults,
    ),
  };
}

export async function getTrendingBooks(
  options?: TrendingBooksOptions,
): Promise<BooksServiceResponse<BookItem[]>> {
  const normalized = normalizeSearchOptions(options);
  const subject = (options?.subject?.trim() || "fiction").toLowerCase();

  const response = await booksRequest<GoogleBooksVolumesResponse>("/volumes", {
    q: `subject:${subject}`,
    startIndex: normalized.startIndex,
    maxResults: normalized.maxResults,
    orderBy: "newest",
    langRestrict: normalized.langRestrict,
    printType: normalized.printType,
  });

  const mapped = mapVolumesResponse(response.data, normalized);
  return {
    ...mapped,
    status: response.status,
  };
}

export async function searchBooks(
  query: string,
  options?: BooksSearchOptions,
): Promise<BooksServiceResponse<BookItem[]>> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error("searchBooks requires a non-empty query.");
  }

  const normalized = normalizeSearchOptions(options);

  const response = await booksRequest<GoogleBooksVolumesResponse>("/volumes", {
    q: normalizedQuery,
    startIndex: normalized.startIndex,
    maxResults: normalized.maxResults,
    orderBy: normalized.orderBy,
    langRestrict: normalized.langRestrict,
    printType: normalized.printType,
  });

  const mapped = mapVolumesResponse(response.data, normalized);
  return {
    ...mapped,
    status: response.status,
  };
}

export async function searchBooksAdvanced(
  filters: BooksAdvancedFilters,
  options?: BooksSearchOptions,
): Promise<BooksServiceResponse<BookItem[]>> {
  const query = buildAdvancedQuery(filters);
  return searchBooks(query, options);
}

export async function searchBookByIsbn(
  isbn: string,
  options?: Omit<BooksSearchOptions, "orderBy">,
): Promise<BooksServiceResponse<BookItem[]>> {
  const normalizedIsbn = isbn.trim();
  if (!normalizedIsbn) {
    throw new Error("searchBookByIsbn requires a non-empty ISBN.");
  }

  return searchBooks(`isbn:${normalizedIsbn}`, {
    ...options,
    orderBy: "relevance",
  });
}

export async function getBookDetails(
  volumeId: string,
): Promise<BooksServiceResponse<BookItem>> {
  const normalizedVolumeId = volumeId.trim();
  if (!normalizedVolumeId) {
    throw new Error("getBookDetails requires a non-empty volumeId.");
  }

  const response = await booksRequest<GoogleBooksRawVolume>(
    `/volumes/${normalizedVolumeId}`,
  );
  const mapped = mapVolumeToBook(response.data);

  if (!mapped) {
    throw new BooksApiError(
      "Book details payload is missing required fields.",
      response.status,
      response.data,
    );
  }

  return {
    data: mapped,
    status: response.status,
  };
}

export async function getBooksBySubject(
  subject: string,
  options?: BooksSearchOptions,
): Promise<BooksServiceResponse<BookItem[]>> {
  const normalizedSubject = subject.trim();
  if (!normalizedSubject) {
    throw new Error("getBooksBySubject requires a non-empty subject.");
  }

  return searchBooks(`subject:${normalizedSubject}`, {
    ...options,
    orderBy: options?.orderBy ?? "newest",
  });
}

export const booksService = {
  getTrendingBooks,
  searchBooks,
  searchBooksAdvanced,
  searchBookByIsbn,
  getBookDetails,
  getBooksBySubject,
};
