-- Trivia questions live in Supabase so new categories and questions can be added without releasing a new app.
create table if not exists public.trivia_questions (
  id bigint generated always as identity primary key,
  category text not null,
  difficulty text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  question text not null,
  correct text not null,
  wrong text[] not null check (array_length(wrong, 1) = 3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (question)
);
create index if not exists trivia_questions_category_idx on public.trivia_questions (category) where active;
alter table public.trivia_questions enable row level security;
drop policy if exists "Anyone can read active trivia" on public.trivia_questions;
create policy "Anyone can read active trivia" on public.trivia_questions for select using (active);
-- No insert/update/delete policies: only you (dashboard or service key) can change questions.
