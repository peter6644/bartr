-- End-to-end check of the trade rules as two real users would hit them.
\set ON_ERROR_STOP 0
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;

insert into auth.users values
 ('11111111-1111-1111-1111-111111111111','boxer@test.com'),
 ('22222222-2222-2222-2222-222222222222','barber@test.com'),
 ('33333333-3333-3333-3333-333333333333','stranger@test.com');

set role authenticated;

-- each user creates their own profile, services and wants
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into profiles (id, handle, name, zip, hood, onboarded) values (auth.uid(), 'boxer', 'Rico', '90042', 'Highland Park', true);
insert into services (id, user_id, category, title, duration_min) values ('aaaaaaa1-0000-0000-0000-000000000000', auth.uid(), 'Boxing', '1:1 boxing lesson', 60);
insert into wants (user_id, label) values (auth.uid(), 'Haircut');
\echo '--- expect FAIL: write someone else''s profile'
insert into profiles (id, handle, name) values ('22222222-2222-2222-2222-222222222222', 'fake', 'Fake');

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into profiles (id, handle, name, zip, hood, onboarded) values (auth.uid(), 'marcus.cuts', 'Marcus', '90301', 'Inglewood', true);
insert into services (id, user_id, category, title, duration_min) values ('bbbbbbb1-0000-0000-0000-000000000000', auth.uid(), 'Haircut', 'Fade + beard trim', 45);
insert into services (id, user_id, category, title, duration_min) values ('bbbbbbb2-0000-0000-0000-000000000000', auth.uid(), 'Haircut', 'Kids cut', 30);
insert into wants (user_id, label) values (auth.uid(), 'Boxing');

select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
insert into profiles (id, handle, name, onboarded) values (auth.uid(), 'stranger', 'Sam', true);

-- Rico proposes
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select propose_trade('22222222-2222-2222-2222-222222222222','bbbbbbb1-0000-0000-0000-000000000000','aaaaaaa1-0000-0000-0000-000000000000', now() + interval '3 days', 'Marcus''s shop', 'Can we do Saturday?') as trade_id \gset
\echo '--- expect FAIL: proposer accepts own proposal'
select respond_trade(:'trade_id','accept');
\echo '--- expect FAIL: insert a trade directly'
insert into trades (proposer_id, receiver_id, proposer_service_id, receiver_service_id) values (auth.uid(),'22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000000','bbbbbbb1-0000-0000-0000-000000000000');

-- stranger cannot see it
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '--- expect 0 / 0: stranger sees trade / messages'
select count(*) from trades; select count(*) from messages;
\echo '--- expect FAIL: stranger posts into the trade chat'
insert into messages (trade_id, sender_id, body) values (:'trade_id', auth.uid(), 'hi');

-- Marcus counters with the kids cut
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select counter_trade(:'trade_id','aaaaaaa1-0000-0000-0000-000000000000','bbbbbbb2-0000-0000-0000-000000000000', now() + interval '4 days', 'My shop', 'Kids cut for my son instead?');
\echo '--- expect FAIL: Marcus accepts his own counter'
select respond_trade(:'trade_id','accept');

-- Rico accepts the counter
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '--- expect accepted'
select respond_trade(:'trade_id','accept');
select status, counter_count, (select title from services where id = receiver_service_id) as rico_gets from trades;
\echo '--- expect FAIL: review before completion'
select submit_review(:'trade_id', 5, '{Quality}', 'great');
\echo '--- expect accepted (only Rico done)'
select respond_trade(:'trade_id','done');

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\echo '--- expect completed'
select respond_trade(:'trade_id','done');
insert into messages (trade_id, sender_id, body) values (:'trade_id', auth.uid(), 'Thanks man!');

-- double-blind reviews
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select submit_review(:'trade_id', 5, '{Quality,"On time"}', 'Clean fade for my kid.');
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '--- expect 0: stranger sees a one-sided review'
select count(*) from reviews;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\echo '--- expect 0: Marcus sees Rico''s review before writing his'
select count(*) from reviews;
select submit_review(:'trade_id', 4, '{}', 'Good coach.');
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '--- expect 2: both reviews now public'
select count(*) from reviews;
\echo '--- expect 1 trade, ratings 5.0 for Marcus and 4.0 for Rico'
select p.handle, s.trades, s.rating, s.reviews from profile_stats(array['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222']::uuid[]) s join profiles p using (id) order by 1;

-- unread + mark read
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '--- expect unread >= 1 for Rico'
select unread from my_unread();
select mark_read(:'trade_id');
\echo '--- expect no rows after mark_read'
select * from my_unread();

-- blocking
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
insert into blocks (blocker_id, blocked_id) values (auth.uid(), '22222222-2222-2222-2222-222222222222');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\echo '--- expect stranger id hidden for Marcus'
select * from my_hidden_ids();

-- storage folder rule
\echo '--- expect OK then FAIL: upload into own folder, then someone else''s'
insert into storage.objects (bucket_id, name) values ('media', '22222222-2222-2222-2222-222222222222/a.jpg');
insert into storage.objects (bucket_id, name) values ('media', '11111111-1111-1111-1111-111111111111/b.jpg');
reset role;
