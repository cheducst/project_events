create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{"events":[],"players":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, data)
values ('main', '{"events":[],"players":[]}'::jsonb)
on conflict (id) do nothing;
