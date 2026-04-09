### Harmonogram prac (Lista ToDo)

#### Faza 1: Inicjalizacja i Konfiguracja (Środowisko i Pamięć)

- [x] Zainicjuj projekt poleceniem `npx create-expo-app@latest --template tabs`.
- [x] Oczyść katalog `app/` z domyślnego kodu i przygotuj czyste grupy tras: `(tabs)`, `(auth)`.
- [ ] Zainstaluj klienta Supabase (`@supabase/supabase-js`).
- [ ] Zainstaluj `react-native-mmkv` i skonfiguruj plik adaptera, aby Supabase używało MMKV do bezpiecznego przechowywania tokenów sesji.
- [ ] Zainstaluj i skonfiguruj `expo-sqlite`. Utwórz zapytania inicjalizujące tabele bazy lokalnej (np. `CREATE TABLE IF NOT EXISTS offline_items (...)`).

#### Faza 2: Backend (Supabase)

- [ ] Utwórz projekt w panelu Supabase.
- [ ] Skonfiguruj autoryzację (włącz e-mail/hasło oraz wybrane zewnętrzne integracje, np. Google).
- [ ] Utwórz strukturę tabel w PostgreSQL (np. `profiles`, `user_items`, `friendships`, `activity_logs`).
- [ ] Skonfiguruj polityki RLS (Row Level Security):
  - [ ] Tabele `profiles` publiczne dla odczytu, edycja tylko dla właściciela.
  - [ ] Tabele `user_items` ukryte dla niezalogowanych, odczyt tylko dla właściciela i jego znajomych.
- [ ] Napisz w bazie funkcji (Triggers), która automatycznie tworzy rekord w tabeli `profiles` i `activity_logs` po nowej rejestracji w module Auth.

#### Faza 3: Uwierzytelnianie i Nawigacja bazowa

- [ ] Zbuduj ekrany logowania i rejestracji w katalogu `app/(auth)`.
- [ ] Utwórz niestandardowy hook (np. `useAuth.ts`), który nasłuchuje zmian stanu sesji z Supabase.
- [ ] W pliku `app/_layout.tsx` wdróż logikę ochrony tras (Route Protection): jeśli brak aktywnej sesji, przekieruj do `(auth)`, w przeciwnym razie do `(tabs)`.

#### Faza 4: Integracja API zewnętrznych

- [ ] Uzyskaj klucz API do TMDB i zwiększ limit (zweryfikuj kartę) w Google Cloud Console dla Google Books API.
- [ ] Utwórz pliki serwisów (np. `tmdbService.ts`, `booksService.ts`) zawierające funkcje do:
  - [ ] Pobierania trendów (dla Ekranu Głównego).
  - [ ] Wyszukiwania zaawansowanego (z paginacją).
  - [ ] Pobierania szczegółów konkretnej pozycji.

#### Faza 5: Budowa Głównego Interfejsu (Tabs)

- [ ] **Przeglądarki (Filmy i Książki):**
  - [ ] Zaimplementuj pasek wyszukiwania i listę wyników z leniwym ładowaniem (Infinite Scroll).
  - [ ] Wdróż moduł "Odkrywaj/Mood" (filtrowanie po gatunkach/słowach kluczowych z API).
  - [ ] Zbuduj ekran szczegółów (opis, plakat, ocena) z przyciskami akcji: "Dodaj do Watchlist", "Zignoruj", "Obejrzane".
- [ ] **Ekran Główny:** Zaimplementuj widoki przewijane w poziomie (Horizontal ScrollView) dla list topowych pozycji i nowości.
- [ ] **Społeczność:** Zbuduj listę (Feed) pobierającą aktywność (recenzje, dodania do list) od powiązanych kont (znajomych).
- [ ] **Konto:** Zbuduj panel zarządzania profilem i odnośniki do osobistych zestawień.

#### Faza 6: Logika Offline i Synchronizacja

- [ ] Po naciśnięciu "Dodaj do Watchlist":
  1. Sprawdź dostęp do sieci.
  2. Jeśli online: wyślij do Supabase i zapisz w `expo-sqlite`.
  3. Jeśli offline: zapisz tylko w `expo-sqlite` z dodatkową flagą `sync_pending: true`.
- [ ] Wdróż mechanizm synchronizacji w tle. Przy każdym uruchomieniu aplikacji sprawdź flagi `sync_pending` i wyślij zaległe operacje do Supabase.

#### Faza 7: Optymalizacja i Testy

- [ ] Wdróż buforowanie (caching) zapytań do TMDB i Google Books za pomocą biblioteki takiej jak np. `@tanstack/react-query`, aby zminimalizować niepotrzebne zużycie sieci.
- [ ] Testy wydajności przewijania długich list (użyj `FlashList` z `@shopify/flash-list` zamiast standardowego `FlatList`).
- [ ] Testy na fizycznych urządzeniach (Android/iOS) z wymuszonym odłączeniem sieci (tryb samolotowy).
