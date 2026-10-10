-- =====================================================================
-- BARTR database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run once on a new project.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tables ----------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  handle      text unique not null check (handle ~ '^[a-z0-9._]{3,24}$'),
  name        text not null check (char_length(name) between 1 and 60),
  bio         text not null default '' check (char_length(bio) <= 300),
  role        text not null default '' check (char_length(role) <= 60),
  hood        text not null default '',
  zip         text not null default '' check (zip ~ '^([0-9]{5})?$'),
  avatar_path text,
  socials     jsonb not null default '[]'::jsonb,
  license     text not null default '' check (char_length(license) <= 120),
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.services (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  category     text not null check (char_length(category) between 1 and 40),
  title        text not null check (char_length(title) between 1 and 80),
  duration_min int  not null check (duration_min between 15 and 600),
  location     text not null default '' check (char_length(location) <= 80),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on public.services(user_id);

create table public.wants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index wants_user_label on public.wants(user_id, lower(label));

create table public.media (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  service_id   uuid references public.services(id) on delete set null,
  kind         text not null check (kind in ('photo','video')),
  path         text not null,
  caption      text not null default '' check (char_length(caption) <= 140),
  duration_sec int,
  created_at   timestamptz not null default now()
);
create index on public.media(user_id, created_at desc);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table public.saves (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  saved_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, saved_id),
  check (user_id <> saved_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.trades (
  id                  uuid primary key default gen_random_uuid(),
  proposer_id         uuid not null references public.profiles(id) on delete cascade,
  receiver_id         uuid not null references public.profiles(id) on delete cascade,
  proposer_service_id uuid not null references public.services(id),
  receiver_service_id uuid not null references public.services(id),
  scheduled_at        timestamptz,
  location            text not null default '',
  status              text not null default 'proposed'
                      check (status in ('proposed','accepted','completed','declined','cancelled')),
  awaiting_id         uuid references public.profiles(id),
  counter_count       int not null default 0,
  proposer_done       boolean not null default false,
  receiver_done       boolean not null default false,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (proposer_id <> receiver_id)
);
create index on public.trades(proposer_id);
create index on public.trades(receiver_id);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  trade_id   uuid not null references public.trades(id) on delete cascade,
  sender_id  uuid references public.profiles(id) on delete set null,
  kind       text not null default 'text' check (kind in ('text','system')),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.messages(trade_id, created_at);

create table public.trade_reads (
  trade_id     uuid not null references public.trades(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (trade_id, user_id)
);

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  trade_id    uuid not null references public.trades(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  tags        text[] not null default '{}',
  body        text not null default '' check (char_length(body) <= 1000),
  created_at  timestamptz not null default now(),
  unique (trade_id, reviewer_id)
);
create index on public.reviews(reviewee_id);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  trade_id    uuid references public.trades(id) on delete set null,
  reason      text not null check (char_length(reason) between 1 and 60),
  details     text not null default '' check (char_length(details) <= 1000),
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);

-- ---------- helpers ---------------------------------------------------

-- A review becomes visible once both people reviewed, or 7 days after it was written.
create or replace function public.review_released(r public.reviews) returns boolean
language sql stable security definer set search_path = public as $$
  select r.created_at < now() - interval '7 days'
      or exists (select 1 from public.reviews o where o.trade_id = r.trade_id and o.reviewer_id = r.reviewee_id);
$$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- Everyone the current user has blocked or been blocked by (hidden from Discover).
create or replace function public.my_hidden_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union select blocker_id from public.blocks where blocked_id = auth.uid();
$$;

create or replace function public.profile_stats(ids uuid[])
returns table (id uuid, trades int, rating numeric, reviews int, followers int, following int)
language sql stable security definer set search_path = public as $$
  select p.id,
    (select count(*)::int from public.trades t where t.status = 'completed' and p.id in (t.proposer_id, t.receiver_id)),
    (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.reviewee_id = p.id and public.review_released(r)),
    (select count(*)::int from public.reviews r where r.reviewee_id = p.id and public.review_released(r)),
    (select count(*)::int from public.follows f where f.followee_id = p.id),
    (select count(*)::int from public.follows f where f.follower_id = p.id)
  from public.profiles p where p.id = any(ids);
$$;

create or replace function public.my_unread() returns table (trade_id uuid, unread int)
language sql stable security definer set search_path = public as $$
  select t.id, count(m.id)::int
  from public.trades t
  join public.messages m on m.trade_id = t.id and m.sender_id is distinct from auth.uid()
  left join public.trade_reads tr on tr.trade_id = t.id and tr.user_id = auth.uid()
  where auth.uid() in (t.proposer_id, t.receiver_id)
    and m.created_at > coalesce(tr.last_read_at, 'epoch'::timestamptz)
  group by t.id;
$$;

create or replace function public.mark_read(p_trade uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trades where id = p_trade and auth.uid() in (proposer_id, receiver_id)) then
    raise exception 'Not your trade';
  end if;
  insert into public.trade_reads (trade_id, user_id, last_read_at) values (p_trade, auth.uid(), now())
  on conflict (trade_id, user_id) do update set last_read_at = now();
end $$;

-- ---------- trade actions (the only way trades change) ---------------

create or replace function public.propose_trade(
  p_receiver uuid, p_their_service uuid, p_my_service uuid,
  p_when timestamptz, p_where text, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); new_id uuid; my_name text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if me = p_receiver then raise exception 'You can''t trade with yourself'; end if;
  if public.is_blocked(me, p_receiver) then raise exception 'You can''t trade with this person'; end if;
  if not exists (select 1 from public.services where id = p_their_service and user_id = p_receiver and active) then
    raise exception 'That service is no longer offered'; end if;
  if not exists (select 1 from public.services where id = p_my_service and user_id = me and active) then
    raise exception 'Pick one of your own services'; end if;
  insert into public.trades (proposer_id, receiver_id, proposer_service_id, receiver_service_id, scheduled_at, location, awaiting_id)
  values (me, p_receiver, p_my_service, p_their_service, p_when, coalesce(left(p_where, 120), ''), p_receiver)
  returning id into new_id;
  select name into my_name from public.profiles where id = me;
  insert into public.messages (trade_id, sender_id, kind, body) values (new_id, me, 'system', my_name || ' proposed a trade');
  if coalesce(trim(p_note), '') <> '' then
    insert into public.messages (trade_id, sender_id, kind, body) values (new_id, me, 'text', left(p_note, 2000));
  end if;
  return new_id;
end $$;

create or replace function public.counter_trade(
  p_trade uuid, p_their_service uuid, p_my_service uuid,
  p_when timestamptz, p_where text, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t public.trades; other uuid; my_name text;
begin
  select * into t from public.trades where id = p_trade for update;
  if t.id is null or me not in (t.proposer_id, t.receiver_id) then raise exception 'Not your trade'; end if;
  if t.status <> 'proposed' or t.awaiting_id <> me then raise exception 'It''s not your turn to respond'; end if;
  other := case when me = t.proposer_id then t.receiver_id else t.proposer_id end;
  if not exists (select 1 from public.services where id = p_their_service and user_id = other and active) then
    raise exception 'That service is no longer offered'; end if;
  if not exists (select 1 from public.services where id = p_my_service and user_id = me and active) then
    raise exception 'Pick one of your own services'; end if;
  update public.trades set
    proposer_service_id = case when me = proposer_id then p_my_service else p_their_service end,
    receiver_service_id = case when me = receiver_id then p_my_service else p_their_service end,
    scheduled_at = p_when, location = coalesce(left(p_where, 120), ''),
    awaiting_id = other, counter_count = counter_count + 1, updated_at = now()
  where id = p_trade;
  select name into my_name from public.profiles where id = me;
  insert into public.messages (trade_id, sender_id, kind, body) values (p_trade, me, 'system', my_name || ' sent a counter-offer');
  if coalesce(trim(p_note), '') <> '' then
    insert into public.messages (trade_id, sender_id, kind, body) values (p_trade, me, 'text', left(p_note, 2000));
  end if;
end $$;

create or replace function public.respond_trade(p_trade uuid, p_action text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t public.trades; my_name text; msg text;
begin
  select * into t from public.trades where id = p_trade for update;
  if t.id is null or me not in (t.proposer_id, t.receiver_id) then raise exception 'Not your trade'; end if;
  select name into my_name from public.profiles where id = me;

  if p_action = 'accept' then
    if t.status <> 'proposed' or t.awaiting_id <> me then raise exception 'It''s not your turn to respond'; end if;
    update public.trades set status = 'accepted', awaiting_id = null, updated_at = now() where id = p_trade;
    msg := my_name || ' accepted. It''s a trade!';
  elsif p_action = 'decline' then
    if t.status <> 'proposed' or t.awaiting_id <> me then raise exception 'It''s not your turn to respond'; end if;
    update public.trades set status = 'declined', awaiting_id = null, updated_at = now() where id = p_trade;
    msg := my_name || ' declined';
  elsif p_action = 'cancel' then
    if t.status not in ('proposed','accepted') then raise exception 'This trade can''t be cancelled'; end if;
    update public.trades set status = 'cancelled', awaiting_id = null, updated_at = now() where id = p_trade;
    msg := my_name || ' cancelled the trade';
  elsif p_action = 'done' then
    if t.status <> 'accepted' then raise exception 'Only an accepted trade can be completed'; end if;
    update public.trades set
      proposer_done = proposer_done or me = proposer_id,
      receiver_done = receiver_done or me = receiver_id,
      updated_at = now()
    where id = p_trade returning * into t;
    if t.proposer_done and t.receiver_done then
      update public.trades set status = 'completed', completed_at = now() where id = p_trade;
      msg := 'Trade complete. Reviews are open.';
    else
      msg := my_name || ' marked the trade complete';
    end if;
  else
    raise exception 'Unknown action';
  end if;

  insert into public.messages (trade_id, sender_id, kind, body) values (p_trade, me, 'system', msg);
  select status into msg from public.trades where id = p_trade;
  return msg;
end $$;

create or replace function public.submit_review(p_trade uuid, p_rating int, p_tags text[], p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t public.trades; other uuid;
begin
  select * into t from public.trades where id = p_trade;
  if t.id is null or me not in (t.proposer_id, t.receiver_id) then raise exception 'Not your trade'; end if;
  if t.status <> 'completed' then raise exception 'You can review once you both mark the trade complete'; end if;
  other := case when me = t.proposer_id then t.receiver_id else t.proposer_id end;
  insert into public.reviews (trade_id, reviewer_id, reviewee_id, rating, tags, body)
  values (p_trade, me, other, p_rating, coalesce(p_tags, '{}'), left(coalesce(p_body, ''), 1000));
end $$;

-- ---------- row-level security ----------------------------------------

alter table public.profiles    enable row level security;
alter table public.services    enable row level security;
alter table public.wants       enable row level security;
alter table public.media       enable row level security;
alter table public.follows     enable row level security;
alter table public.saves       enable row level security;
alter table public.blocks      enable row level security;
alter table public.trades      enable row level security;
alter table public.messages    enable row level security;
alter table public.trade_reads enable row level security;
alter table public.reviews     enable row level security;
alter table public.reports     enable row level security;

-- Profiles and what people offer are visible to anyone signed in.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "services readable" on public.services for select to authenticated using (true);
create policy "own services insert" on public.services for insert to authenticated with check (user_id = auth.uid());
create policy "own services update" on public.services for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wants readable" on public.wants for select to authenticated using (true);
create policy "own wants insert" on public.wants for insert to authenticated with check (user_id = auth.uid());
create policy "own wants delete" on public.wants for delete to authenticated using (user_id = auth.uid());

create policy "media readable" on public.media for select to authenticated using (true);
create policy "own media insert" on public.media for insert to authenticated with check (user_id = auth.uid());
create policy "own media update" on public.media for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own media delete" on public.media for delete to authenticated using (user_id = auth.uid());

create policy "follows readable" on public.follows for select to authenticated using (true);
create policy "own follows insert" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "own follows delete" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "own saves" on public.saves for select to authenticated using (user_id = auth.uid());
create policy "own saves insert" on public.saves for insert to authenticated with check (user_id = auth.uid());
create policy "own saves delete" on public.saves for delete to authenticated using (user_id = auth.uid());

create policy "own blocks" on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "own blocks insert" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "own blocks delete" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- Trades: only the two people in it can see it; changes go through the functions above.
create policy "trade participants read" on public.trades for select to authenticated
  using (auth.uid() in (proposer_id, receiver_id));

create policy "trade participants read messages" on public.messages for select to authenticated
  using (exists (select 1 from public.trades t where t.id = trade_id and auth.uid() in (t.proposer_id, t.receiver_id)));
create policy "trade participants send messages" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid() and kind = 'text'
    and exists (select 1 from public.trades t where t.id = trade_id and auth.uid() in (t.proposer_id, t.receiver_id)
                and not public.is_blocked(t.proposer_id, t.receiver_id))
  );

create policy "own reads" on public.trade_reads for select to authenticated using (user_id = auth.uid());

-- Reviews: you always see your own; everyone sees a review once it's released (double-blind).
create policy "reviews visible" on public.reviews for select to authenticated
  using (reviewer_id = auth.uid() or public.review_released(reviews));

create policy "file a report" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- ---------- permissions for the functions ------------------------------

revoke execute on function public.propose_trade(uuid, uuid, uuid, timestamptz, text, text) from public, anon;
revoke execute on function public.counter_trade(uuid, uuid, uuid, timestamptz, text, text) from public, anon;
revoke execute on function public.respond_trade(uuid, text) from public, anon;
revoke execute on function public.submit_review(uuid, int, text[], text) from public, anon;
revoke execute on function public.mark_read(uuid) from public, anon;
grant execute on function public.propose_trade(uuid, uuid, uuid, timestamptz, text, text) to authenticated;
grant execute on function public.counter_trade(uuid, uuid, uuid, timestamptz, text, text) to authenticated;
grant execute on function public.respond_trade(uuid, text) to authenticated;
grant execute on function public.submit_review(uuid, int, text[], text) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;

-- ---------- live updates for chat and trades ---------------------------

alter publication supabase_realtime add table public.messages, public.trades;

-- ---------- photo and video storage ----------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/*', 'video/*'])
on conflict (id) do nothing;

create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
