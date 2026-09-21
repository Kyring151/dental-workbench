-- ==========================================================
-- 齿案台 · Supabase 数据库初始化脚本
-- 在 Supabase 控制台 → SQL Editor → 粘贴并 Run 一次即可
-- 作用：建病例表 + 用户资料表，并开启行级安全(RLS)，
--       保证只有「登录的本人」能读写自己的数据。
-- ==========================================================

-- 1) 用户资料表（存首页姓氏称呼）
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  surname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "本人可管理自己的资料" on public.profiles;
create policy "本人可管理自己的资料"
  on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 2) 病例表（整个病例对象存在 payload jsonb 列里，字段可随意扩展）
create table if not exists public.cases (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cases enable row level security;

drop policy if exists "本人可管理自己的病例" on public.cases;
create policy "本人可管理自己的病例"
  on public.cases
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

create index if not exists cases_owner_idx on public.cases (owner);