import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createMMKV, deleteMMKV, type MMKV } from "react-native-mmkv";

const STORAGE_ID = "read-n-watch-storage";
const ENCRYPTION_KEY_ALIAS = "read-n-watch-mmkv-encryption-key";

let _storage: MMKV | null = null;

const createEncryptionKey = async () => {
  // 16 losowych bajtow zamienionych na 32-znakowy hex string.
  // To jest wystarczajacy material klucza dla lokalnie szyfrowanego storage sesji.
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getOrCreateEncryptionKey = async () => {
  const existingKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS);

  if (existingKey) {
    return existingKey;
  }

  const newKey = await createEncryptionKey();
  await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, newKey);
  return newKey;
};

/**
 * Musi być wywołane raz podczas startu aplikacji (przed jakąkolwiek
 * operacją na storage lub Supabase auth).
 *
 * - iOS   → klucz w Keychain
 * - Android → klucz w Keystore (EncryptedSharedPreferences)
 * - Web   → MMKV bez szyfrowania (brak Keychain; środowisko deweloperskie)
 */
export async function initializeStorage(): Promise<void> {
  if (_storage !== null) {
    return;
  }

  if (Platform.OS === "web") {
    _storage = createMMKV({ id: STORAGE_ID });
    return;
  }

  try {
    _storage = createMMKV({
      id: STORAGE_ID,
      encryptionKey: await getOrCreateEncryptionKey(),
      encryptionType: "AES-256",
    });
  } catch {
    // Recovery dla przypadku rozjechania SecureStore i pliku MMKV po restore/migracji urzadzenia.
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY_ALIAS);
    deleteMMKV(STORAGE_ID);

    _storage = createMMKV({
      id: STORAGE_ID,
      encryptionKey: await getOrCreateEncryptionKey(),
      encryptionType: "AES-256",
    });
  }
}

/**
 * Zwraca istniejącą instancję MMKV.
 * Rzuca błąd, jeśli initializeStorage() nie zostało jeszcze wywołane.
 */
export function getStorage(): MMKV {
  if (_storage === null) {
    throw new Error(
      "[mmkv] Storage nie jest zainicjalizowane. Wywołaj initializeStorage() przed użyciem storage.",
    );
  }
  return _storage;
}
