-- Run in Supabase > SQL Editor AFTER your own phone (or Google account) has signed in to the app once.
-- This lets that one account create Mchongwano tournaments and pair rounds from inside the app.
-- Phone form: international, no plus sign. 0724726032 becomes 254724726032.
insert into public.roast_admins (user_id)
select id from auth.users where phone = '254724726032'
on conflict do nothing;

-- Or use an email instead:
-- insert into public.roast_admins (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;

-- To see who is an admin:  select * from public.roast_admins;
-- To remove an admin:      delete from public.roast_admins where user_id = (select id from auth.users where phone = '254724726032');

-- Handy when testing: set the speaking time to 20 seconds so a whole battle takes a couple of minutes.
-- update public.app_settings set value = '20' where key in ('roast_turn_seconds', 'roast_vote_seconds');
-- Put it back for real use:
-- update public.app_settings set value = '60' where key = 'roast_turn_seconds';
-- update public.app_settings set value = '20' where key = 'roast_vote_seconds';

-- If you ever change the roast rules text, make everyone accept it again by changing the version:
-- update public.app_settings set value = '2026-12-v2' where key = 'roast_terms_version';
