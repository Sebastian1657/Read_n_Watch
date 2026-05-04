import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

const DATABASE_NAME = "read_n_watch.db";

let database: SQLiteDatabase | null = null;
let initializationPromise: Promise<void> | null = null;

export type LocalContentType = "movie" | "book";

export type LocalItemStatus =
  | "watchlist"
  | "readlist"
  | "watched"
  | "read"
  | "ignored";

export interface LocalItemInput {
  contentType: LocalContentType;
  externalId: string;
  title: string;
  status: LocalItemStatus;
  subtitle?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  review?: string | null;
  metadata?: Record<string, unknown>;
  syncPending?: boolean;
}

export interface LocalItemRecord {
  id: number;
  contentType: LocalContentType;
  externalId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  status: LocalItemStatus;
  rating: number | null;
  review: string | null;
  metadataJson: string;
  syncPending: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueRecord {
  id: number;
  operation: string;
  payloadJson: string;
  syncPending: number;
  createdAt: string;
}

const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS offline_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  status TEXT NOT NULL,
  rating INTEGER,
  review TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  sync_pending INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_offline_items_status ON offline_items(status);
CREATE INDEX IF NOT EXISTS idx_offline_items_sync_pending ON offline_items(sync_pending);

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  sync_pending INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(sync_pending);
`;

export async function initializeLocalDatabase(): Promise<void> {
  if (database !== null) {
    return;
  }

  if (initializationPromise !== null) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const openedDatabase = await openDatabaseAsync(DATABASE_NAME);
    await openedDatabase.execAsync(CREATE_SCHEMA_SQL);
    database = openedDatabase;
  })();

  try {
    await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

export function getLocalDatabase(): SQLiteDatabase {
  if (database === null) {
    throw new Error(
      "[sqlite] Local database is not initialized. Call initializeLocalDatabase() before using it.",
    );
  }

  return database;
}

export async function saveLocalItem(input: LocalItemInput): Promise<void> {
  const db = getLocalDatabase();
  const metadataJson = JSON.stringify(input.metadata ?? {});
  const syncPending = input.syncPending === false ? 0 : 1;

  await db.runAsync(
    `
      INSERT INTO offline_items (
        content_type,
        external_id,
        title,
        subtitle,
        image_url,
        status,
        rating,
        review,
        metadata_json,
        sync_pending,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(content_type, external_id) DO UPDATE SET
        title = excluded.title,
        subtitle = excluded.subtitle,
        image_url = excluded.image_url,
        status = excluded.status,
        rating = excluded.rating,
        review = excluded.review,
        metadata_json = excluded.metadata_json,
        sync_pending = excluded.sync_pending,
        updated_at = CURRENT_TIMESTAMP;
    `,
    [
      input.contentType,
      input.externalId,
      input.title,
      input.subtitle ?? null,
      input.imageUrl ?? null,
      input.status,
      input.rating ?? null,
      input.review ?? null,
      metadataJson,
      syncPending,
    ],
  );
}

export async function getLocalItemsByStatus(
  status: LocalItemStatus,
): Promise<LocalItemRecord[]> {
  const db = getLocalDatabase();

  return db.getAllAsync<LocalItemRecord>(
    `
      SELECT
        id,
        content_type AS contentType,
        external_id AS externalId,
        title,
        subtitle,
        image_url AS imageUrl,
        status,
        rating,
        review,
        metadata_json AS metadataJson,
        sync_pending AS syncPending,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM offline_items
      WHERE status = ?
      ORDER BY updated_at DESC;
    `,
    [status],
  );
}

export async function getPendingSyncItems(): Promise<LocalItemRecord[]> {
  const db = getLocalDatabase();

  return db.getAllAsync<LocalItemRecord>(
    `
      SELECT
        id,
        content_type AS contentType,
        external_id AS externalId,
        title,
        subtitle,
        image_url AS imageUrl,
        status,
        rating,
        review,
        metadata_json AS metadataJson,
        sync_pending AS syncPending,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM offline_items
      WHERE sync_pending = 1
      ORDER BY updated_at ASC;
    `,
  );
}

export async function markLocalItemSynced(
  contentType: LocalContentType,
  externalId: string,
): Promise<void> {
  const db = getLocalDatabase();

  await db.runAsync(
    `
      UPDATE offline_items
      SET sync_pending = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE content_type = ? AND external_id = ?;
    `,
    [contentType, externalId],
  );
}

export async function enqueueSyncOperation(
  operation: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getLocalDatabase();

  await db.runAsync(
    `
      INSERT INTO sync_queue (operation, payload_json, sync_pending)
      VALUES (?, ?, 1);
    `,
    [operation, JSON.stringify(payload)],
  );
}

export async function getPendingSyncOperations(): Promise<SyncQueueRecord[]> {
  const db = getLocalDatabase();

  return db.getAllAsync<SyncQueueRecord>(
    `
      SELECT
        id,
        operation,
        payload_json AS payloadJson,
        sync_pending AS syncPending,
        created_at AS createdAt
      FROM sync_queue
      WHERE sync_pending = 1
      ORDER BY created_at ASC;
    `,
  );
}
