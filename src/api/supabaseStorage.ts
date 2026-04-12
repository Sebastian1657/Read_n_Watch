import { getStorage } from "@/src/store/mmkv";

const SESSION_KEY_PREFIX = "supabase.auth.token";

const createScopedKey = (key: string) => {
  if (key.startsWith(SESSION_KEY_PREFIX)) {
    return key;
  }

  return `${SESSION_KEY_PREFIX}.${key}`;
};

export const supabaseStorage = {
  getItem: async (key: string) => {
    const value = getStorage().getString(createScopedKey(key));
    return value ?? null;
  },
  setItem: async (key: string, value: string) => {
    getStorage().set(createScopedKey(key), value);
  },
  removeItem: async (key: string) => {
    getStorage().remove(createScopedKey(key));
  },
};
