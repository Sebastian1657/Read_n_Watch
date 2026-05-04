-- Read n Watch: initial schema + RLS + triggers
-- Designed for Supabase (Postgres + Auth + built-in RLS helpers)

begin;

-- Helpful in Supabase projects for gen_random_uuid().
create extension if not exists pgcrypto;

-- 1) Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  is_public boolean default false,
  is_admin boolean default false,
  is_banned boolean default false,
  ban_reason text check (char_length(ban_reason) <= 500),
  created_at timestamptz not null default now()
);

-- Ensure all columns exist (for existing tables from older migrations)
alter table if exists public.profiles add column if not exists is_public boolean default false;
alter table if exists public.profiles add column if not exists is_admin boolean default false;
alter table if exists public.profiles add column if not exists is_banned boolean default false;
alter table if exists public.profiles add column if not exists ban_reason text;

-- 2) Movies cache (TMDB)
create table if not exists public.movies (
  id bigint primary key,
  title text not null,
  poster_path text,
  release_date date
);

-- 3) Books cache (Google Books)
create table if not exists public.books (
  id text primary key,
  title text not null,
  author text,
  cover_url text
);

-- 4) User movies state
create table if not exists public.user_movies (
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  status text not null check (status in ('watchlist', 'watched', 'ignored')),
  rating smallint check (rating between 1 and 10),
  review_text text,
  mood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

-- 5) User books state
create table if not exists public.user_books (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  status text not null check (status in ('readlist', 'read', 'ignored')),
  rating smallint check (rating between 1 and 10),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- 6) Social graph
create table if not exists public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- 7) Activity feed / logs
create table if not exists public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  movie_id bigint references public.movies(id) on delete set null,
  book_id text references public.books(id) on delete set null,
  visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  check (
    -- exactly one content target must be set for one event
    (movie_id is not null and book_id is null) or (movie_id is null and book_id is not null)
  )
);

-- Ensure all columns exist (for existing tables from older migrations)
alter table if exists public.user_movies add column if not exists created_at timestamptz default now();
alter table if exists public.user_movies add column if not exists updated_at timestamptz default now();
alter table if exists public.user_movies add column if not exists mood text;
alter table if exists public.user_books add column if not exists created_at timestamptz default now();
alter table if exists public.user_books add column if not exists updated_at timestamptz default now();
alter table if exists public.activity_feed add column if not exists visibility text default 'friends';

-- Canonical constraints reconciliation (safe re-run)
alter table if exists public.profiles
  drop constraint if exists profiles_ban_reason_check;
alter table if exists public.profiles
  add constraint profiles_ban_reason_check
  check (char_length(ban_reason) <= 500);

alter table if exists public.user_movies
  drop constraint if exists user_movies_status_check;
alter table if exists public.user_movies
  add constraint user_movies_status_check
  check (status in ('watchlist', 'watched', 'ignored'));

alter table if exists public.user_movies
  drop constraint if exists user_movies_rating_check;
alter table if exists public.user_movies
  add constraint user_movies_rating_check
  check (rating between 1 and 10);

alter table if exists public.user_books
  drop constraint if exists user_books_status_check;
alter table if exists public.user_books
  add constraint user_books_status_check
  check (status in ('readlist', 'read', 'ignored'));

alter table if exists public.user_books
  drop constraint if exists user_books_rating_check;
alter table if exists public.user_books
  add constraint user_books_rating_check
  check (rating between 1 and 10);

alter table if exists public.friendships
  drop constraint if exists friendships_check;
alter table if exists public.friendships
  add constraint friendships_check
  check (requester_id <> addressee_id);

alter table if exists public.friendships
  drop constraint if exists friendships_status_check;
alter table if exists public.friendships
  add constraint friendships_status_check
  check (status in ('pending', 'accepted', 'blocked'));

alter table if exists public.activity_feed
  drop constraint if exists activity_feed_visibility_check;
alter table if exists public.activity_feed
  add constraint activity_feed_visibility_check
  check (visibility in ('private', 'friends', 'public'));

alter table if exists public.activity_feed
  drop constraint if exists activity_feed_check;
alter table if exists public.activity_feed
  drop constraint if exists activity_feed_single_target_check;
alter table if exists public.activity_feed
  add constraint activity_feed_single_target_check
  check (
    (movie_id is not null and book_id is null)
    or
    (movie_id is null and book_id is not null)
  );

-- Indexes for performance and RLS filters
create index if not exists idx_user_movies_user_id on public.user_movies(user_id);
create index if not exists idx_user_movies_movie_id on public.user_movies(movie_id);
create index if not exists idx_user_movies_updated_at on public.user_movies(updated_at desc);

create index if not exists idx_user_books_user_id on public.user_books(user_id);
create index if not exists idx_user_books_book_id on public.user_books(book_id);
create index if not exists idx_user_books_updated_at on public.user_books(updated_at desc);

create index if not exists idx_friendships_addressee_status on public.friendships(addressee_id, status);
create index if not exists idx_friendships_requester_status on public.friendships(requester_id, status);

create index if not exists idx_profiles_banned on public.profiles(is_banned) where is_banned = true;
create index if not exists idx_profiles_is_admin on public.profiles(is_admin) where is_admin = true;
create index if not exists idx_activity_feed_visibility on public.activity_feed(visibility) where visibility in ('public', 'friends');

-- Friendship status constraint is reconciled in canonical constraints section above.

-- Utility trigger: maintain updated_at for state tables
create or replace function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_movies_set_updated_at on public.user_movies;
create trigger trg_user_movies_set_updated_at
before update on public.user_movies
for each row
execute function public.set_updated_at_now();

drop trigger if exists trg_user_books_set_updated_at on public.user_books;
create trigger trg_user_books_set_updated_at
before update on public.user_books
for each row
execute function public.set_updated_at_now();

-- Guard friendship updates so only explicit pending -> accepted/blocked transitions are allowed.
create or replace function public.guard_friendship_update()
returns trigger
language plpgsql
as $$
begin
  if old.requester_id <> new.requester_id or old.addressee_id <> new.addressee_id then
    raise exception 'Cannot change friendship participants.';
  end if;

  if old.created_at <> new.created_at then
    raise exception 'Cannot change friendship created_at timestamp.';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending' and (new.status = 'accepted' or new.status = 'blocked') then
    return new;
  end if;

  raise exception 'Invalid friendship status transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists trg_friendships_guard_update on public.friendships;
create trigger trg_friendships_guard_update
before update on public.friendships
for each row
execute function public.guard_friendship_update();

-- Admin check: security definer function to avoid infinite recursion in RLS policies
create or replace function public.is_admin(check_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists(
    select 1 from public.profiles
    where id = check_id and is_admin = true
  );
end;
$$;

-- Guard against privilege escalation: prevent users from modifying admin/ban flags
create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
as $$
declare
  jwt_role text;
begin
  -- Allow trusted system contexts (SQL editor / service role) to perform bootstrap and admin operations.
  jwt_role := auth.role();
  if current_user in ('postgres', 'supabase_admin') or jwt_role = 'service_role' then
    return new;
  end if;

  -- If attempting to change admin or ban status
  if (old.is_admin IS DISTINCT FROM new.is_admin)
      or (old.is_banned IS DISTINCT FROM new.is_banned)
      or (old.ban_reason IS DISTINCT FROM new.ban_reason) then
    -- Only admins can modify these fields
    if not public.is_admin(auth.uid()) then
      raise exception 'Unauthorized: cannot modify privilege-related fields (is_admin, is_banned, ban_reason)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_privilege_escalation on public.profiles;
create trigger trg_prevent_privilege_escalation
before update on public.profiles
for each row
execute function public.prevent_privilege_escalation();

-- Auth bootstrap: create profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := split_part(coalesce(new.email, ''), '@', 1);

  if base_username is null or base_username = '' then
    base_username := 'user';
  end if;

  final_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]+', '', 'g'));
  if final_username = '' then
    final_username := 'user';
  end if;

  -- Ensure uniqueness with deterministic suffix from user id.
  final_username := left(final_username, 20) || '_' || left(replace(new.id::text, '-', ''), 8);

  insert into public.profiles (id, username)
  values (new.id, final_username)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Enable RLS (Supabase-native approach)
alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.books enable row level security;
alter table public.user_movies enable row level security;
alter table public.user_books enable row level security;
alter table public.friendships enable row level security;
alter table public.activity_feed enable row level security;

-- Clean re-run support
-- Policies

drop policy if exists profiles_select_self_or_friends on public.profiles;
create policy profiles_select_self_or_friends
on public.profiles
for select
to authenticated
using (
  is_banned = false
  and (
    (select auth.uid()) = id
    or is_public = true
    or exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id = profiles.id)
          or
          (f.addressee_id = (select auth.uid()) and f.requester_id = profiles.id)
        )
    )
  )
);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists profiles_admin_ban_or_edit on public.profiles;
create policy profiles_admin_ban_or_edit
on public.profiles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Cached content can be read by logged users.
drop policy if exists movies_select_authenticated on public.movies;
create policy movies_select_authenticated
on public.movies
for select
to authenticated
using (true);

drop policy if exists books_select_authenticated on public.books;
create policy books_select_authenticated
on public.books
for select
to authenticated
using (true);

-- Optional write-through cache from clients.
drop policy if exists movies_insert_authenticated on public.movies;
create policy movies_insert_authenticated
on public.movies
for insert
to authenticated
with check (true);

drop policy if exists movies_update_authenticated on public.movies;
-- Intentionally no UPDATE policy for movies cache.
-- Existing cache entries must not be mutable from mobile clients.

drop policy if exists movies_admin_delete on public.movies;
create policy movies_admin_delete
on public.movies
for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists books_insert_authenticated on public.books;
create policy books_insert_authenticated
on public.books
for insert
to authenticated
with check (true);

drop policy if exists books_update_authenticated on public.books;
-- Intentionally no UPDATE policy for books cache.
-- Existing cache entries must not be mutable from mobile clients.

drop policy if exists books_admin_delete on public.books;
create policy books_admin_delete
on public.books
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- User movie states: owner CRUD + friends read.
drop policy if exists user_movies_select_owner_or_friends on public.user_movies;
create policy user_movies_select_owner_or_friends
on public.user_movies
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = (select auth.uid()) and f.addressee_id = user_movies.user_id)
        or
        (f.addressee_id = (select auth.uid()) and f.requester_id = user_movies.user_id)
      )
  )
);

drop policy if exists user_movies_insert_owner on public.user_movies;
create policy user_movies_insert_owner
on public.user_movies
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists user_movies_update_owner on public.user_movies;
create policy user_movies_update_owner
on public.user_movies
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists user_movies_delete_owner on public.user_movies;
create policy user_movies_delete_owner
on public.user_movies
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- User book states: owner CRUD + friends read.
drop policy if exists user_books_select_owner_or_friends on public.user_books;
create policy user_books_select_owner_or_friends
on public.user_books
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = (select auth.uid()) and f.addressee_id = user_books.user_id)
        or
        (f.addressee_id = (select auth.uid()) and f.requester_id = user_books.user_id)
      )
  )
);

drop policy if exists user_books_insert_owner on public.user_books;
create policy user_books_insert_owner
on public.user_books
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists user_books_update_owner on public.user_books;
create policy user_books_update_owner
on public.user_books
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists user_books_delete_owner on public.user_books;
create policy user_books_delete_owner
on public.user_books
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Friendships: both sides can read; requester creates; addressee can accept.
-- IMPORTANT: Blocked relationships are NOT visible to requester (privacy protection)
drop policy if exists friendships_select_participants on public.friendships;
create policy friendships_select_participants
on public.friendships
for select
to authenticated
using (
  ((select auth.uid()) = requester_id and status in ('pending', 'accepted'))
  or
  ((select auth.uid()) = addressee_id and status in ('pending', 'accepted', 'blocked'))
);

drop policy if exists friendships_insert_requester on public.friendships;
create policy friendships_insert_requester
on public.friendships
for insert
to authenticated
with check (
  (select auth.uid()) = requester_id
  and requester_id <> addressee_id
  and status = 'pending'
);

drop policy if exists friendships_update_participants on public.friendships;
drop policy if exists friendships_update_accept_addressee on public.friendships;
drop policy if exists friendships_update_accept_or_block_addressee on public.friendships;
create policy friendships_update_accept_or_block_addressee
on public.friendships
for update
to authenticated
using (
  (select auth.uid()) = addressee_id
  and status = 'pending'
)
with check (
  (select auth.uid()) = addressee_id
  and (status = 'accepted' or status = 'blocked')
);

drop policy if exists friendships_delete_requester on public.friendships;
drop policy if exists friendships_delete_participants on public.friendships;
create policy friendships_delete_participants
on public.friendships
for delete
to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

-- Activity feed: owner inserts/updates visibility; owner + friends can read based on visibility.
drop policy if exists activity_feed_select_owner_or_friends on public.activity_feed;
create policy activity_feed_select_owner_or_friends
on public.activity_feed
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (
    visibility = 'public'
    and exists (
      select 1 from public.profiles where id = activity_feed.user_id and is_banned = false
    )
  )
  or (
    visibility = 'friends'
    and exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id = activity_feed.user_id)
          or
          (f.addressee_id = (select auth.uid()) and f.requester_id = activity_feed.user_id)
        )
    )
  )
);

drop policy if exists activity_feed_insert_owner on public.activity_feed;
create policy activity_feed_insert_owner
on public.activity_feed
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists activity_feed_update_owner on public.activity_feed;
create policy activity_feed_update_owner
on public.activity_feed
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
-- Protect immutable fields (action_type, user_id, created_at, movie_id, book_id cannot change)
-- Only visibility can be updated
-- Note: This is enforced at application level; DB trigger can add extra protection if needed

drop policy if exists activity_feed_delete_owner on public.activity_feed;
create policy activity_feed_delete_owner
on public.activity_feed
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================================
-- ADMIN POLICIES: Admins can view, ban, and manage user data
-- ============================================================================

-- Admins can read any profile
drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select
on public.profiles
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can read all friendships
drop policy if exists friendships_admin_select on public.friendships;
create policy friendships_admin_select
on public.friendships
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can delete any friendship (for moderation)
drop policy if exists friendships_admin_delete on public.friendships;
create policy friendships_admin_delete
on public.friendships
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can read all activity feed entries
drop policy if exists activity_feed_admin_select on public.activity_feed;
create policy activity_feed_admin_select
on public.activity_feed
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can delete any activity feed entry (for moderation)
drop policy if exists activity_feed_admin_delete on public.activity_feed;
create policy activity_feed_admin_delete
on public.activity_feed
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can read all user movies (audit purposes)
drop policy if exists user_movies_admin_select on public.user_movies;
create policy user_movies_admin_select
on public.user_movies
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can delete any user movie (for moderation)
drop policy if exists user_movies_admin_delete on public.user_movies;
create policy user_movies_admin_delete
on public.user_movies
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can read all user books (audit purposes)
drop policy if exists user_books_admin_select on public.user_books;
create policy user_books_admin_select
on public.user_books
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can delete any user book (for moderation)
drop policy if exists user_books_admin_delete on public.user_books;
create policy user_books_admin_delete
on public.user_books
for delete
to authenticated
using (public.is_admin(auth.uid()));

commit;
