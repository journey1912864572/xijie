create table if not exists public.question_bank_progress (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.question_bank_progress enable row level security;

drop policy if exists "allow anonymous sync reads" on public.question_bank_progress;
drop policy if exists "allow anonymous sync upserts" on public.question_bank_progress;

create policy "allow anonymous sync reads"
on public.question_bank_progress
for select
to anon
using (true);

create policy "allow anonymous sync upserts"
on public.question_bank_progress
for all
to anon
using (true)
with check (true);
