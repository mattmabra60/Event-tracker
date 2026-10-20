-- WTM / What's the Move?
-- Run this file in Supabase Dashboard -> SQL Editor.
-- It is safe to run more than once: policies are replaced and event seeds upsert.

-- -----------------------------------------------------------------------------
-- Events shown throughout the app
-- -----------------------------------------------------------------------------

create table if not exists public.events (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  category text not null,
  venue text,
  address text,
  city text not null default 'Rexburg',
  state text not null default 'ID',
  starts_at timestamptz not null,
  ends_at timestamptz,
  price numeric(10, 2) not null default 0 check (price >= 0),
  image_theme text not null default 'sunset',
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  constraint events_title_starts_at_key unique (title, starts_at),
  constraint events_end_after_start_check check (ends_at is null or ends_at >= starts_at)
);

-- Reconcile tables created by an earlier version of this script.
alter table public.events add column if not exists ends_at timestamptz;
alter table public.events add column if not exists image_theme text not null default 'sunset';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_title_starts_at_key'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_title_starts_at_key unique (title, starts_at);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'events_end_after_start_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_end_after_start_check
      check (ends_at is null or ends_at >= starts_at);
  end if;
end;
$$;

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_category_idx on public.events (category);

-- Private profile data associated with a Supabase Auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  city text not null default 'Rexburg',
  state text not null default 'ID',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Leave username null until the user explicitly claims one. This prevents
  -- duplicate usernames in metadata from blocking Auth user creation.
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Events a user wants to remember.
create table if not exists public.saved_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id bigint not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- Events a user plans to attend.
create table if not exists public.event_attendance (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id bigint not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists saved_events_event_id_idx on public.saved_events (event_id);
create index if not exists event_attendance_event_id_idx on public.event_attendance (event_id);

-- -----------------------------------------------------------------------------
-- Seed data used by the current WTM screens
-- -----------------------------------------------------------------------------

insert into public.events
  (title, description, category, venue, address, city, state, starts_at, ends_at, price, image_theme, latitude, longitude)
values
  ('Rexburg Rooftop Sessions', 'Enjoy live music and spend the evening meeting new people.', 'MUSIC', 'The Cove', '220 S 2nd W', 'Rexburg', 'ID', '2026-10-23 20:00:00-06', '2026-10-23 22:00:00-06', 0, 'sunset', 43.8231, -111.7924),
  ('Table Rock Campground Sunset Hike', 'Watch the sunset while exploring the outdoors.', 'OUTDOORS', 'Table Rock campground', 'Forest Road 217', 'Ririe', 'ID', '2026-10-24 18:00:00-06', '2026-10-24 20:30:00-06', 0, 'green', 43.5517, -111.7728),
  ('Downtown Taco Walk', 'Explore local food and enjoy a walk through downtown.', 'FOOD', 'Downtown Rexburg', 'E Main St', 'Rexburg', 'ID', '2026-10-24 12:00:00-06', '2026-10-24 14:00:00-06', 0, 'orange', 43.8260, -111.7890),
  ('Rexburg Farmers Market', 'Find local food, handmade goods, and neighborhood vendors.', 'MARKET', 'Porter Park', 'S 2nd W & 3rd W', 'Rexburg', 'ID', '2026-10-24 09:00:00-06', '2026-10-24 13:00:00-06', 0, 'yellow', 43.8243, -111.7942),
  ('Laughs at The Atrium', 'A night of stand-up comedy and good company.', 'NIGHTLIFE', 'The Atrium', '160 W 2nd S #207', 'Rexburg', 'ID', '2026-10-23 21:30:00-06', '2026-10-23 23:00:00-06', 10, 'purple', 43.8250, -111.7907),
  ('Park Cleanup Crew', 'Volunteer with the local cleanup crew and meet your neighbors.', 'COMMUNITY', 'Smith Park', 'E Main St', 'Rexburg', 'ID', '2026-10-24 10:00:00-06', '2026-10-24 12:00:00-06', 0, 'blue', 43.8292, -111.7837),
  ('Open Mic Night at The School', 'Bring a song, a story, or just come support local performers.', 'COMMUNITY', 'The School', '525 S Center St', 'Rexburg', 'ID', '2026-10-29 19:00:00-06', '2026-10-29 21:00:00-06', 0, 'purple', 43.8177, -111.7865)
on conflict (title, starts_at) do update set
  description = excluded.description,
  category = excluded.category,
  venue = excluded.venue,
  address = excluded.address,
  city = excluded.city,
  state = excluded.state,
  ends_at = excluded.ends_at,
  price = excluded.price,
  image_theme = excluded.image_theme,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_events enable row level security;
alter table public.event_attendance enable row level security;

drop policy if exists "Anyone can view events" on public.events;
create policy "Anyone can view events"
  on public.events for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view their own saved events" on public.saved_events;
create policy "Users can view their own saved events"
  on public.saved_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can save their own events" on public.saved_events;
create policy "Users can save their own events"
  on public.saved_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own saved events" on public.saved_events;
create policy "Users can remove their own saved events"
  on public.saved_events for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own attendance" on public.event_attendance;
create policy "Users can view their own attendance"
  on public.event_attendance for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can mark their own attendance" on public.event_attendance;
create policy "Users can mark their own attendance"
  on public.event_attendance for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own attendance" on public.event_attendance;
create policy "Users can remove their own attendance"
  on public.event_attendance for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.events to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.saved_events to authenticated;
grant select, insert, delete on public.event_attendance to authenticated;
