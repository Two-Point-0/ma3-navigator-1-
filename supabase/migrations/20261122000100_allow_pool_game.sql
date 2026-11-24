-- Let the new Pool game save scores and sessions.
alter table public.game_sessions drop constraint if exists game_sessions_game_id_check;
alter table public.route_game_scores drop constraint if exists route_game_scores_game_id_check;
alter table public.game_sessions add constraint game_sessions_game_id_check check (game_id in ('trivia','chess','ludo','draughts','memory','g2048','snake','whack','tycoon','pool'));
alter table public.route_game_scores add constraint route_game_scores_game_id_check check (game_id in ('trivia','chess','ludo','draughts','memory','g2048','snake','whack','tycoon','pool'));
