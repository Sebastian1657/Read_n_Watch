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
    try {
      const value = getStorage().getString(createScopedKey(key));
      return value ?? null;
    } catch {
      // Storage nie jest jeszcze zainicjalizowane (Supabase woła storage
      // asynchronicznie od razu po createClient, zanim initializeStorage()
      // zdazy sie wykonac). Zwracamy null — Supabase potraktuje to jak brak sesji
      // i ponowi probe po pelnej inicjalizacji.
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      getStorage().set(createScopedKey(key), value);
    } catch {
      // j.w. — zapis zostanie powtorzony gdy Supabase odswiezy token po inicjalizacji.
    }
  },
  removeItem: async (key: string) => {
    try {
      getStorage().remove(createScopedKey(key));
    } catch {
      // j.w.
    }
  },
};
