-- Run this in Supabase > SQL Editor AFTER the driver test phone has signed in once in the app.
-- Change the phone and routes to match. The phone is written in international form WITHOUT a plus sign.
-- Example: 0182578382 becomes 254182578382.
insert into public.ma3_driver_profiles (user_id, route_ids, status, reviewed_at)
select id, array['10000116011','10000114011'], 'approved', now()   -- 116 and 114R, change as you like
from auth.users
where phone = '254182578382'
on conflict (user_id) do update set route_ids = excluded.route_ids, status = 'approved', reviewed_at = now();

-- To switch the driver off again:
-- update public.ma3_driver_profiles set status = 'suspended' where user_id = (select id from auth.users where phone = '254182578382');
