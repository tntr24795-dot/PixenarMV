-- Additive persistence only. Render remains gated until E2E checks pass.
create table if not exists public.long_drama_manifests (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  manifest jsonb not null,
  updated_at timestamptz not null default now(),
  constraint long_drama_manifest_object check (jsonb_typeof(manifest) = 'object')
);
create index if not exists long_drama_manifests_user_idx on public.long_drama_manifests(user_id);
alter table public.long_drama_manifests enable row level security;
revoke all on public.long_drama_manifests from anon, authenticated;
grant select on public.long_drama_manifests to authenticated;
drop policy if exists long_drama_manifest_owner_select on public.long_drama_manifests;
create policy long_drama_manifest_owner_select on public.long_drama_manifests for select to authenticated using ((select auth.uid()) = user_id);
-- Writes must occur from a verified server-side service role after ownership validation.
