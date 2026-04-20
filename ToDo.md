### Harmonogram prac (Lista ToDo)

#### Faza 0: Infrastruktura i Projekt

- [x] **Domena**: `read-n-watch.eu` (NameSilo) - dla SMTP i przyszłych serwisów web.
- [x] **Email (SMTP)**: Resend API (100 msg/day free tier) - do wiadomościAuth i notyfikacji.
- [x] **SSL/TLS**: Free SSL z NameSilo - domyślnie dla wszystkich połączeń.
- [x] **Projekt**: React Native/Expo + TypeScript + Supabase (PostgreSQL RLS) + MMKV + expo-sqlite.
- [x] **Rate Limits**: Auth (2 emails/h), OTP (30/h), Simkl (wg planu API), Google Books (1k/day).
- [x] **Supabase**: Free tier - 50k MAU, 500MB DB, 5GB transfer, 5GB storage.
- [ ] **Monitoring**: (Zaplanować dla Fazy 8+) - Sentry/LogRocket dla errorów i performance.

#### Faza 1: Inicjalizacja i Konfiguracja (Środowisko i Pamięć)

- [x] Zainicjuj projekt poleceniem `npx create-expo-app@latest --template tabs`.
- [x] Oczyść katalog `app/` z domyślnego kodu i przygotuj czyste grupy tras: `(tabs)`, `(auth)`.
- [x] Zainstaluj klienta Supabase (`@supabase/supabase-js`).
- [x] Zainstaluj `react-native-mmkv` i skonfiguruj plik adaptera, aby Supabase używało MMKV do bezpiecznego przechowywania tokenów sesji.
- [x] Zainstaluj i skonfiguruj `expo-sqlite`. Utwórz zapytania inicjalizujące tabele bazy lokalnej (`offline_items`, `sync_queue`).

#### Faza 2: Backend (Supabase)

- [x] Utwórz projekt w panelu Supabase.
- [x] Skonfiguruj autoryzację (włącz e-mail/hasło oraz wybrane zewnętrzne integracje, np. Google).
- [x] Zdefiniuj docelową architekturę tabel w Supabase:
  - [x] `profiles` (konto użytkownika): `id` (PK/FK `auth.users.id`), `username` (UNIQUE, NOT NULL), `avatar_url`, `is_public`, `is_admin`, `is_banned`, `ban_reason`, `created_at`.
  - [x] `movies` (cache TMDB): `id` (PK, `int8`), `title`, `poster_path`, `release_date`.
  - [x] `books` (cache Google Books): `id` (PK, `text`), `title`, `author`, `cover_url`.
  - [x] `user_movies` (stan filmu per user): PK (`user_id`, `movie_id`), `status` in (`watchlist`, `watched`, `ignored`), `rating` 1-10, `review_text`, `mood`, `created_at`, `updated_at`.
  - [x] `user_books` (stan książki per user): PK (`user_id`, `book_id`), `status` in (`readlist`, `read`, `ignored`), `rating` 1-10, `review_text`, `created_at`, `updated_at`.
  - [x] `friendships` (relacje społeczne): PK (`requester_id`, `addressee_id`), `status` in (`pending`, `accepted`, `blocked`), `created_at`.
  - [x] `activity_feed` (tablica i logi): `id` (PK), `user_id` (FK), `action_type`, `visibility` in (`private`, `friends`, `public`), opcjonalne `movie_id`/`book_id`, `created_at`.
- [x] Przygotuj skrypt SQL z tabelami, indeksami, triggerami i politykami RLS (`supabase/001_initial_schema_rls.sql`).
- [x] Zaimplementuj strukturę tabel w PostgreSQL z typami danych, constraints i indeksami.
- [x] Skonfiguruj kompleksowe polityki RLS (Row Level Security):
  - [x] `profiles`: SELECT (self/friends/public), UPDATE (self lub admin), UPDATE-admin (ban/promote).
  - [x] `movies`/`books`: SELECT (authenticated), INSERT (authenticated), DELETE (admin).
  - [x] `user_movies`/`user_books`: SELECT (owner/friends), CRUD (owner only).
  - [x] `friendships`: SELECT (self+participants), INSERT (requester), UPDATE (addressee accept/block), DELETE (both).
  - [x] `activity_feed`: SELECT (owner/friends/public + visibility), INSERT/UPDATE (owner), DELETE (owner/admin).
- [x] Zaimplementuj Triggery do zarządzania stanem aplikacji:
  - [x] `set_updated_at_now()`: Automatycznie utrzymuje `updated_at` w tabelach stanu.
  - [x] `guard_friendship_update()`: Wymusza ścieżkę pending→accepted/blocked.
  - [x] `prevent_privilege_escalation()`: Chroni `is_admin`/`is_banned` przed eskalacją uprawnień.
  - [x] `handle_new_user()`: Tworzy profil po rejestracji w Auth.
- [x] Wdróż funkcję `is_admin()` z flagą `STABLE` do ewaluacji uprawnień bez nieskończonej rekurencji RLS i z cache'owaniem wyniku.
- [x] Zdefiniuj polityki Admin:
  - [x] SELECT all na wszystkie tabele (profilowanie, audyt).
  - [x] DELETE na cache, activity_feed, user_movies, user_books (moderacja).
  - [x] UPDATE profiles (ban/promote).
- [x] Bezpieczeństwo: Naprawianie luk:
  - [x] Nieskończona rekurencja RLS → `security definer` + `STABLE`.
  - [x] Privilege escalation → Trigger `prevent_privilege_escalation()`.
  - [x] N+1 performance → Flaga `STABLE` na is_admin(), indeksy na is_admin/is_banned/visibility.
  - [x] Blocked friendship privacy leak → Requester nie widzi (status='blocked').
  - [x] Brakujący admin DELETE cache → movies_admin_delete, books_admin_delete.
  - [x] CHECK constraint (NULL,NULL) → Wymuszenie dokładnie jednego NOT NULL w activity_feed.

#### Faza 3: Uwierzytelnianie i Nawigacja bazowa

- [x] Zbuduj ekrany logowania i rejestracji w katalogu `app/(auth)`.
- [x] Utwórz niestandardowy hook (np. `useAuth.ts`), który nasłuchuje zmian stanu sesji z Supabase.
- [x] W pliku `app/_layout.tsx` wdróż logikę ochrony tras (Route Protection): jeśli brak aktywnej sesji, przekieruj do `(auth)`, w przeciwnym razie do `(tabs)`.
- [x] MMKV Storage: Bezpieczne przechowywanie tokenów sesji w `src/api/supabaseStorage.ts`.
- [x] Lokalna baza danych: Centralna warstwa SQLite w `src/store/localDb.ts` z tabelami `offline_items` i `sync_queue`.

#### Faza 4: Integracja API zewnętrznych

- [x] Uzyskaj klucz API do Simkl i zweryfikuj warunki użycia dla projektu komercyjnego; osobno utrzymaj Google Books API dla książek.
- [x] Utwórz pliki serwisów (np. `simklService.ts`, `booksService.ts`) zawierające funkcje do:
  - [x] Pobierania trendów (dla Ekranu Głównego).
  - [x] Wyszukiwania zaawansowanego (z paginacją).
  - [x] Pobierania szczegółów konkretnej pozycji.

#### Faza 5: Budowa Głównego Interfejsu (Tabs)

- [ ] **Przeglądarki (Filmy i Książki):**
  - [ ] Zaimplementuj pasek wyszukiwania i listę wyników z leniwym ładowaniem (Infinite Scroll).
  - [ ] Wdróż moduł "Odkrywaj/Mood" (filtrowanie po gatunkach/słowach kluczowych z API).
  - [ ] Zbuduj ekran szczegółów (opis, plakat, ocena) z przyciskami akcji: "Dodaj do Watchlist", "Zignoruj", "Obejrzane".
- [ ] **Ekran Główny:** Zaimplementuj widoki przewijane w poziomie (Horizontal ScrollView) dla list topowych pozycji i nowości.
- [ ] **Społeczność:** Zbuduj listę (Feed) pobierającą aktywność (recenzje, dodania do list) od powiązanych kont (znajomych).
- [ ] **Konto:** Zbuduj panel zarządzania profilem i odnośniki do osobistych zestawień.

#### Faza 8: Monetyzacja i Model Przychodu

- [ ] **Reklamy:** Zdefiniuj miejsca ekspozycji reklam w aplikacji (feed, discovery, puste stany) oraz zasady ich częstotliwości.
- [ ] **Bez reklam:** Dodaj możliwość wykupienia planu bez reklam (jednorazowy zakup lub subskrypcja).
- [ ] **Płatności:** Zaimplementuj bramkę płatności i logikę weryfikacji statusu zakupu po stronie backendu.
- [ ] **Uprawnienia premium:** Wprowadź flagę/subskrypcję premium w profilu użytkownika i egzekwuj ją w UI oraz backendzie.
- [ ] **Analityka monetyzacji:** Przygotuj mierzenie konwersji, retention i wpływu reklam na użycie aplikacji.

#### Faza 6: Logika Offline i Synchronizacja

- [ ] Po naciśnięciu "Dodaj do Watchlist":
  1. Sprawdź dostęp do sieci.
  2. Jeśli online: wyślij do Supabase i zapisz w `expo-sqlite`.
  3. Jeśli offline: zapisz tylko w `expo-sqlite` z dodatkową flagą `sync_pending: true`.
- [ ] Wdróż mechanizm synchronizacji w tle. Przy każdym uruchomieniu aplikacji sprawdź flagi `sync_pending` i wyślij zaległe operacje do Supabase.
- [x] Utwórz centralną warstwę lokalnego zapisu w `src/store/localDb.ts` i inicjalizuj ją przy starcie aplikacji.

#### Faza 7: Optymalizacja i Testy

- [ ] Wdróż buforowanie (caching) zapytań do TMDB i Google Books za pomocą biblioteki takiej jak np. `@tanstack/react-query`, aby zminimalizować niepotrzebne zużycie sieci.
- [ ] Testy wydajności przewijania długich list (użyj `FlashList` z `@shopify/flash-list` zamiast standardowego `FlatList`).
- [ ] Testy na fizycznych urządzeniach (Android/iOS) z wymuszonym odłączeniem sieci (tryb samolotowy).

---

## 📊 STATUS OGÓLNY

### ✅ Ukończone Fazy

- **Faza 0**: Infrastruktura ✅
- **Faza 1**: Bootstrap Expo + MMKV + SQLite ✅
- **Faza 2**: Backend - Schemat + RLS + Triggery ✅
- **Faza 2b**: Deployment SQL do Supabase ✅
- **Faza 3**: Auth + Nawigacja ✅

### ⏳ W Trakcie (Jutro)

- **Faza 2c**: Seeding (test user + admin) + Weryfikacja RLS
- **Faza 4**: API Services (Simkl, Google Books)

### 📋 Zaplanowane

- **Faza 5**: UI Tabs (Movies, Books, Home, Community, Profile)
- **Faza 6**: Offline Sync Logic
- **Faza 7**: Optimization & Testing
- **Faza 8**: Monetization (ads, no-ads, payments, premium)

---

## 🔐 SEEDING & VERIFICATION (JUTRO)

### Test Data Setup:

- [ ] Utwórz admin user (email: admin@test.com, password: test123)
- [ ] Utwórz 3 regular users (user1@test.com, user2@test.com, user3@test.com)
- [ ] Promuj admin user: `UPDATE profiles SET is_admin = true WHERE username LIKE 'admin%'`
- [ ] Setup friendships:
  - [ ] user1 wysyła zaproszenie do user2 (pending)
  - [ ] user2 akceptuje (accepted)
  - [ ] user1 wysyła zaproszenie do user3, user3 blokuje (blocked)

### RLS Verification Tests:

- [ ] User1 nie widzi user3 (is_banned test)
- [ ] User1 NIE widzi że jest zablokowany przez user3
- [ ] User1 widzi user2 profile (accepted friend)
- [ ] Admin widzi wszystkich + może DELETE
- [ ] User1 nie może UPDATE is_admin na swoim profilu
- [ ] Activity feed visibility: private/friends/public filtering

### Performance Benchmarks:

- [ ] SELECT \* FROM profiles → <100ms
- [ ] SELECT activity_feed WHERE visibility='public' → <200ms
- [ ] Admin SELECT all tables → <500ms (cached is_admin())

---

## 📝 DZISIEJSZE OSIĄGNIĘCIA

### ✅ Ukończone:

**Backend Architecture (Supabase)**

- 7 tabel z pełnym schematem (profiles, movies, books, user_movies, user_books, friendships, activity_feed)
- 4 Triggery (set_updated_at, guard_friendship, prevent_escalation, handle_new_user)
- 1 Helper Function (is_admin z STABLE flag)
- 25+ RLS Polityk (user + admin policies)
- 8 Performance Indeksów (na is_admin, is_banned, visibility itd)

**Security Hardening**

- Blokada nieskończonej rekurencji RLS (security definer)
- Ochrona przed privilege escalation (trigger)
- N+1 performance fix (STABLE flag na is_admin)
- Blocked friendship privacy (requester nie widzi)
- Admin moderation tools (DELETE cache, activity, items)
- CHECK constraints (dokładnie 1 NOT NULL w activity_feed)

**Migration Support**

- Idempotentny SQL (CREATE IF NOT EXISTS + ALTER TABLE ADD IF NOT EXISTS)
- Automatyczne aktualizacja constraints dla 'blocked' status
- Bezpieczne re-run bez błędów

**Documentation**

- Zaktualizowany ToDo.md ze szczegółami RLS
- Checklist do seedowania i testowania
- Status ogólny i roadmap

### 🔧 Kod Gotowy:

- `supabase/001_initial_schema_rls.sql` (635+ linii, fully tested)
- `app/_layout.tsx` (route protection)
- `src/api/supabaseStorage.ts` (MMKV adapter)
- `src/store/localDb.ts` (SQLite persistence)
- `src/hooks/useAuth.tsx` (auth state)

### 🔄 Zmieniony kierunek:

- Integracja filmowa przechodzi z TMDB na Simkl, bo projekt jest komercyjny i potrzebuje zgodności z warunkami użycia oraz przewidywalnego modelu kosztów.
- Monetyzacja staje się osobnym strumieniem prac: reklamy, plan bez reklam, płatności i status premium.

---

## 🚀 NASTĘPNIE (JUTRO)

1. **Seeding** (15 min) - Utwórz test users i setup relacji
2. **Verification** (30 min) - Przetestuj RLS i performance
3. **API Services** (2-3h) - Simkl i Google Books integration
4. **Ready for UI** - Backend w pełni operacyjny

---

## 🎯 NASTĘPNE KROKI

1. **Immediate**: Wdróż SQL w Supabase ✅
2. **Tomorrow**: Seed data + RLS verification
3. **This week**: Implement Simkl + Google Books service layers
4. **Next week**: Build UI for all tabs
5. **Later**: Offline sync + optimization
6. **Then**: Monetization stack (ads, no-ads purchase, payments, premium gating)
