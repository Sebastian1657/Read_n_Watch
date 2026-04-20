-- Read n Watch: seed data (idempotent)
-- Run after 001_initial_schema_rls.sql.
-- This script is safe to run multiple times.
--
-- IMPORTANT:
-- 1) Create test users in Supabase Auth first (Dashboard -> Authentication -> Users).
-- 2) Update emails in the seed_users / friendship / user state blocks below as needed.

begin;

-- -----------------------------------------------------------------------------
-- 1) Global cache data (movies/books)
-- -----------------------------------------------------------------------------
insert into public.movies (id, title, poster_path, release_date)
values
  (550, 'Fight Club', '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', '1999-10-15'),
  (155, 'The Dark Knight', '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', '2008-07-18'),
  (680, 'Pulp Fiction', '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', '1994-09-10'),
  (13, 'Forrest Gump', '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', '1994-07-06'),
  (27205, 'Inception', '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', '2010-07-16')
on conflict (id) do update
set
  title = excluded.title,
  poster_path = excluded.poster_path,
  release_date = excluded.release_date;

insert into public.books (id, title, author, cover_url)
values
  ('zyTCAlFPjgYC', 'The Google Story', 'David A. Vise', 'https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1'),
  ('uW9KDwAAQBAJ', 'Atomic Habits', 'James Clear', 'https://books.google.com/books/content?id=uW9KDwAAQBAJ&printsec=frontcover&img=1&zoom=1'),
  ('N2HbDwAAQBAJ', 'Clean Code', 'Robert C. Martin', 'https://books.google.com/books/content?id=N2HbDwAAQBAJ&printsec=frontcover&img=1&zoom=1'),
  ('m8dPPgAACAAJ', 'The Pragmatic Programmer', 'Andrew Hunt, David Thomas', 'https://books.google.com/books/content?id=m8dPPgAACAAJ&printsec=frontcover&img=1&zoom=1'),
  ('s1gVDAAAQBAJ', 'Deep Work', 'Cal Newport', 'https://books.google.com/books/content?id=s1gVDAAAQBAJ&printsec=frontcover&img=1&zoom=1')
on conflict (id) do update
set
  title = excluded.title,
  author = excluded.author,
  cover_url = excluded.cover_url;

-- -----------------------------------------------------------------------------
-- 2) Profile flags for existing auth users (public/admin)
--    Only users that already exist in auth.users will be updated.
-- -----------------------------------------------------------------------------
with seed_users as (
  select *
  from (
    values
      ('admin@read-n-watch.eu', true, true),
      ('alice@example.com', true, false),
      ('bob@example.com', true, false),
      ('charlie@example.com', false, false)
  ) as t(email, is_public, is_admin)
),
matched_users as (
  select
    au.id,
    su.is_public,
    su.is_admin
  from seed_users su
  join auth.users au on lower(au.email) = lower(su.email)
)
update public.profiles p
set
  is_public = mu.is_public,
  is_admin = mu.is_admin
from matched_users mu
where p.id = mu.id;

-- -----------------------------------------------------------------------------
-- 3) Friendships (insert only when both users exist)
-- -----------------------------------------------------------------------------
with users_by_email as (
  select id, lower(email) as email
  from auth.users
),
seed_friendships as (
  select *
  from (
    values
      ('alice@example.com', 'bob@example.com', 'accepted'::text),
      ('charlie@example.com', 'alice@example.com', 'pending'::text),
      ('bob@example.com', 'charlie@example.com', 'blocked'::text)
  ) as t(requester_email, addressee_email, status)
)
insert into public.friendships (requester_id, addressee_id, status)
select
  r.id,
  a.id,
  sf.status
from seed_friendships sf
join users_by_email r on r.email = lower(sf.requester_email)
join users_by_email a on a.email = lower(sf.addressee_email)
where r.id <> a.id
on conflict (requester_id, addressee_id) do update
set status = excluded.status;

-- -----------------------------------------------------------------------------
-- 4) User movie states
-- -----------------------------------------------------------------------------
with users_by_email as (
  select id, lower(email) as email
  from auth.users
),
seed_user_movies as (
  select *
  from (
    values
      ('alice@example.com', 550::bigint, 'watched'::text, 9::smallint, 'Great atmosphere and pacing.', 'focused'),
      ('alice@example.com', 27205::bigint, 'watchlist'::text, null::smallint, null::text, null::text),
      ('bob@example.com', 155::bigint, 'watched'::text, 10::smallint, 'One of my favorites.', 'hyped'),
      ('charlie@example.com', 13::bigint, 'ignored'::text, null::smallint, null::text, null::text)
  ) as t(email, movie_id, status, rating, review_text, mood)
)
insert into public.user_movies (user_id, movie_id, status, rating, review_text, mood)
select
  u.id,
  sumv.movie_id,
  sumv.status,
  sumv.rating,
  sumv.review_text,
  sumv.mood
from seed_user_movies sumv
join users_by_email u on u.email = lower(sumv.email)
join public.movies m on m.id = sumv.movie_id
on conflict (user_id, movie_id) do update
set
  status = excluded.status,
  rating = excluded.rating,
  review_text = excluded.review_text,
  mood = excluded.mood,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 5) User book states
-- -----------------------------------------------------------------------------
with users_by_email as (
  select id, lower(email) as email
  from auth.users
),
seed_user_books as (
  select *
  from (
    values
      ('alice@example.com', 'uW9KDwAAQBAJ', 'read'::text, 8::smallint, 'Very practical and clear.'),
      ('alice@example.com', 'm8dPPgAACAAJ', 'readlist'::text, null::smallint, null::text),
      ('bob@example.com', 'N2HbDwAAQBAJ', 'read'::text, 9::smallint, 'Must-read for developers.'),
      ('charlie@example.com', 'zyTCAlFPjgYC', 'ignored'::text, null::smallint, null::text)
  ) as t(email, book_id, status, rating, review_text)
)
insert into public.user_books (user_id, book_id, status, rating, review_text)
select
  u.id,
  subk.book_id,
  subk.status,
  subk.rating,
  subk.review_text
from seed_user_books subk
join users_by_email u on u.email = lower(subk.email)
join public.books b on b.id = subk.book_id
on conflict (user_id, book_id) do update
set
  status = excluded.status,
  rating = excluded.rating,
  review_text = excluded.review_text,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 6) Activity feed (deduplicated by action_type + target)
-- -----------------------------------------------------------------------------
with users_by_email as (
  select id, lower(email) as email
  from auth.users
),
seed_activity as (
  select *
  from (
    values
      ('alice@example.com', 'seed_movie_watched_550', 550::bigint, null::text, 'public'::text),
      ('bob@example.com', 'seed_book_read_N2HbDwAAQBAJ', null::bigint, 'N2HbDwAAQBAJ', 'friends'::text)
  ) as t(email, action_type, movie_id, book_id, visibility)
)
insert into public.activity_feed (user_id, action_type, movie_id, book_id, visibility)
select
  u.id,
  sa.action_type,
  sa.movie_id,
  sa.book_id,
  sa.visibility
from seed_activity sa
join users_by_email u on u.email = lower(sa.email)
where not exists (
  select 1
  from public.activity_feed af
  where af.user_id = u.id
    and af.action_type = sa.action_type
    and af.movie_id is not distinct from sa.movie_id
    and af.book_id is not distinct from sa.book_id
);

commit;
