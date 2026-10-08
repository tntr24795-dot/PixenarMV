-- Pixenar Studio credit source policy + 60-day media retention
-- 2026-10-08

alter table public.subscriptions
  add column if not exists billing_interval text,
  add column if not exists current_period_start timestamptz,
  add column if not exists monthly_credit_amount integer,
  add column if not exists credit_anchor_day smallint;

create table if not exists public.credit_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in (
    'subscription_monthly','subscription_annual','topup','welcome','bonus','legacy','admin'
  )),
  source_ref text not null,
  original_credits integer not null check (original_credits > 0),
  remaining_credits integer not null check (remaining_credits >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, source_ref),
  check (reserved_credits <= remaining_credits)
);

create index if not exists credit_buckets_user_expiry_idx
  on public.credit_buckets(user_id, expires_at, created_at);

alter table public.credit_buckets enable row level security;
grant select on public.credit_buckets to authenticated;
revoke insert, update, delete on public.credit_buckets from anon, authenticated;
drop policy if exists "Users can view own credit buckets" on public.credit_buckets;
create policy "Users can view own credit buckets"
  on public.credit_buckets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists private.credit_allocations (
  generation_id uuid not null references public.generations(id) on delete cascade,
  bucket_id uuid not null references public.credit_buckets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  credits integer not null check (credits > 0),
  status text not null default 'reserved' check (status in ('reserved','consumed','released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  primary key(generation_id,bucket_id)
);
alter table private.credit_allocations enable row level security;
revoke all on private.credit_allocations from public,anon,authenticated;

alter table public.generations
  add column if not exists expires_at timestamptz,
  add column if not exists media_deleted_at timestamptz;

alter table public.exports
  add column if not exists expires_at timestamptz,
  add column if not exists media_deleted_at timestamptz;

update public.generations
set expires_at = completed_at + interval '60 days'
where status='succeeded' and completed_at is not null and expires_at is null;

update public.exports
set expires_at = completed_at + interval '60 days'
where status='succeeded' and completed_at is not null and expires_at is null;

insert into public.credit_buckets(
  user_id,source_type,source_ref,original_credits,remaining_credits,reserved_credits,expires_at,metadata
)
select
  w.user_id,
  'legacy',
  'legacy:' || w.user_id::text,
  greatest(w.balance,1),
  w.balance,
  least(w.reserved,w.balance),
  null,
  jsonb_build_object('migrated_from_wallet',true)
from public.credit_wallets w
where w.balance > 0
on conflict(user_id,source_ref) do nothing;

create or replace function private.sync_credit_wallet(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_balance integer;
  v_reserved integer;
begin
  select
    coalesce(sum(remaining_credits),0)::integer,
    coalesce(sum(reserved_credits),0)::integer
  into v_balance,v_reserved
  from public.credit_buckets
  where user_id=p_user_id;

  insert into public.credit_wallets(user_id,balance,reserved,updated_at)
  values(p_user_id,v_balance,v_reserved,now())
  on conflict(user_id) do update
    set balance=excluded.balance,
        reserved=excluded.reserved,
        updated_at=excluded.updated_at;
end;
$$;
revoke all on function private.sync_credit_wallet(uuid) from public,anon,authenticated;

create or replace function private.expire_due_credit_buckets(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_bucket record;
  v_expired integer := 0;
  v_amount integer;
begin
  for v_bucket in
    select *
    from public.credit_buckets
    where user_id=p_user_id
      and expires_at is not null
      and expires_at <= p_at
      and remaining_credits > reserved_credits
    for update
  loop
    v_amount := v_bucket.remaining_credits - v_bucket.reserved_credits;
    update public.credit_buckets
      set remaining_credits=reserved_credits,updated_at=now()
      where id=v_bucket.id;

    insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
    values(
      p_user_id,
      -v_amount,
      'expiry',
      v_bucket.id::text,
      'Unused subscription credits expired'
    );
    v_expired := v_expired + v_amount;
  end loop;

  perform private.sync_credit_wallet(p_user_id);
  return v_expired;
end;
$$;
revoke all on function private.expire_due_credit_buckets(uuid,timestamptz) from public,anon,authenticated;

create or replace function private.grant_credit_bucket(
  p_user_id uuid,
  p_source_type text,
  p_source_ref text,
  p_credits integer,
  p_expires_at timestamptz,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;
  if p_source_type not in (
    'subscription_monthly','subscription_annual','topup','welcome','bonus','legacy','admin'
  ) then
    raise exception 'unsupported credit source';
  end if;
  if p_source_type='topup' and p_expires_at is not null then
    raise exception 'purchased top-up credits cannot expire';
  end if;

  select id into v_id
  from public.credit_buckets
  where user_id=p_user_id and source_ref=p_source_ref;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.credit_buckets(
    user_id,source_type,source_ref,original_credits,remaining_credits,reserved_credits,
    expires_at,metadata
  )
  values(
    p_user_id,p_source_type,p_source_ref,p_credits,p_credits,0,p_expires_at,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;

  insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
  values(p_user_id,p_credits,'grant',v_id::text,left(coalesce(p_description,'Credits granted'),300));

  perform private.sync_credit_wallet(p_user_id);
  return v_id;
end;
$$;
revoke all on function private.grant_credit_bucket(uuid,text,text,integer,timestamptz,text,jsonb) from public,anon,authenticated;

create or replace function private.reserve_generation_credits(
  p_user_id uuid,
  p_generation_id uuid,
  p_amount integer
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_bucket record;
  v_needed integer := p_amount;
  v_take integer;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  perform private.expire_due_credit_buckets(p_user_id,now());

  for v_bucket in
    select *
    from public.credit_buckets
    where user_id=p_user_id
      and remaining_credits-reserved_credits > 0
      and (expires_at is null or expires_at > now())
    order by
      case source_type
        when 'subscription_monthly' then 1
        when 'subscription_annual' then 2
        when 'bonus' then 3
        when 'welcome' then 4
        when 'legacy' then 5
        when 'admin' then 6
        when 'topup' then 7
        else 8
      end,
      expires_at nulls last,
      created_at asc
    for update
  loop
    exit when v_needed <= 0;
    v_take := least(v_needed,v_bucket.remaining_credits-v_bucket.reserved_credits);
    if v_take <= 0 then continue; end if;

    update public.credit_buckets
      set reserved_credits=reserved_credits+v_take,updated_at=now()
      where id=v_bucket.id;

    insert into private.credit_allocations(generation_id,bucket_id,user_id,credits,status)
    values(p_generation_id,v_bucket.id,p_user_id,v_take,'reserved')
    on conflict(generation_id,bucket_id) do update
      set credits=private.credit_allocations.credits+excluded.credits;

    v_needed := v_needed-v_take;
  end loop;

  if v_needed > 0 then
    raise exception using errcode='P0001',message='insufficient credits';
  end if;

  perform private.sync_credit_wallet(p_user_id);
end;
$$;
revoke all on function private.reserve_generation_credits(uuid,uuid,integer) from public,anon,authenticated;

create or replace function private.consume_generation_credits(p_generation_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_item record;
  v_total integer := 0;
  v_user uuid;
begin
  for v_item in
    select a.*,b.expires_at,b.source_type
    from private.credit_allocations a
    join public.credit_buckets b on b.id=a.bucket_id
    where a.generation_id=p_generation_id and a.status='reserved'
    for update of a,b
  loop
    v_user := v_item.user_id;
    update public.credit_buckets
      set remaining_credits=greatest(0,remaining_credits-v_item.credits),
          reserved_credits=greatest(0,reserved_credits-v_item.credits),
          updated_at=now()
      where id=v_item.bucket_id;

    update private.credit_allocations
      set status='consumed',settled_at=now()
      where generation_id=p_generation_id and bucket_id=v_item.bucket_id;

    v_total := v_total+v_item.credits;
  end loop;

  if v_user is not null then perform private.sync_credit_wallet(v_user); end if;
  return v_total;
end;
$$;
revoke all on function private.consume_generation_credits(uuid) from public,anon,authenticated;

create or replace function private.release_generation_credits(p_generation_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_item record;
  v_total integer := 0;
  v_user uuid;
begin
  for v_item in
    select a.*,b.expires_at,b.source_type
    from private.credit_allocations a
    join public.credit_buckets b on b.id=a.bucket_id
    where a.generation_id=p_generation_id and a.status='reserved'
    for update of a,b
  loop
    v_user := v_item.user_id;

    if v_item.expires_at is not null and v_item.expires_at <= now() then
      update public.credit_buckets
        set remaining_credits=greatest(0,remaining_credits-v_item.credits),
            reserved_credits=greatest(0,reserved_credits-v_item.credits),
            updated_at=now()
        where id=v_item.bucket_id;
      insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
      values(v_item.user_id,-v_item.credits,'expiry',v_item.bucket_id::text,'Released credits were already past their expiry date');
    else
      update public.credit_buckets
        set reserved_credits=greatest(0,reserved_credits-v_item.credits),updated_at=now()
        where id=v_item.bucket_id;
    end if;

    update private.credit_allocations
      set status='released',settled_at=now()
      where generation_id=p_generation_id and bucket_id=v_item.bucket_id;

    v_total := v_total+v_item.credits;
  end loop;

  if v_user is not null then perform private.sync_credit_wallet(v_user); end if;
  return v_total;
end;
$$;
revoke all on function private.release_generation_credits(uuid) from public,anon,authenticated;

create or replace function public.grant_topup_credits(
  p_user_id uuid,
  p_payment_ref text,
  p_credits integer
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_payment_ref is null or char_length(btrim(p_payment_ref)) < 6 then
    raise exception 'payment reference is required';
  end if;
  return private.grant_credit_bucket(
    p_user_id,
    'topup',
    'topup:'||btrim(p_payment_ref),
    p_credits,
    null,
    'One-time purchased credits',
    jsonb_build_object('payment_ref',btrim(p_payment_ref),'non_expiring',true)
  );
end;
$$;
revoke all on function public.grant_topup_credits(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.grant_topup_credits(uuid,text,integer) to service_role;

create or replace function public.grant_subscription_cycle(
  p_user_id uuid,
  p_subscription_id uuid,
  p_interval text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_credits integer,
  p_cycle_ref text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_type text;
  v_expires timestamptz;
begin
  if p_interval not in ('month','year') then raise exception 'unsupported billing interval'; end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'invalid subscription period';
  end if;

  perform private.expire_due_credit_buckets(p_user_id,p_period_start);

  v_type := case when p_interval='month' then 'subscription_monthly' else 'subscription_annual' end;
  v_expires := p_period_end;

  return private.grant_credit_bucket(
    p_user_id,
    v_type,
    'subscription:'||p_subscription_id::text||':'||btrim(p_cycle_ref),
    p_credits,
    v_expires,
    case when p_interval='month'
      then 'Monthly subscription credits'
      else 'Annual-plan monthly credit grant'
    end,
    jsonb_build_object(
      'subscription_id',p_subscription_id,
      'billing_interval',p_interval,
      'period_start',p_period_start,
      'period_end',p_period_end,
      'cycle_ref',btrim(p_cycle_ref)
    )
  );
end;
$$;
revoke all on function public.grant_subscription_cycle(uuid,uuid,text,timestamptz,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.grant_subscription_cycle(uuid,uuid,text,timestamptz,timestamptz,integer,text) to service_role;

create or replace function private.enqueue_generation(
  p_project_id uuid,
  p_scene_id uuid,
  p_model text,
  p_duration integer,
  p_prompt text,
  p_request_id uuid,
  p_resolution text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_cost integer;
  v_quote jsonb;
  v_resolution text;
  v_ratio text;
  v_provider text;
  v_generation_id uuid;
begin
  if v_user is null then
    raise exception using errcode='28000', message='authentication required';
  end if;
  if p_prompt is null or char_length(btrim(p_prompt)) < 3 or char_length(p_prompt) > 4000 then
    raise exception using errcode='22023', message='invalid prompt';
  end if;

  select coalesce(p_resolution,resolution),aspect_ratio into v_resolution,v_ratio
  from public.projects where id=p_project_id and user_id=v_user;
  v_quote := private.video_price_quote(p_model,p_duration,v_resolution);
  v_cost := (v_quote->>'credits')::integer;
  v_provider := v_quote->>'provider';

  if not exists(select 1 from private.video_provider_readiness where provider=v_provider and enabled) then
    raise exception 'provider not configured';
  end if;
  if not exists(select 1 from public.projects where id=p_project_id and user_id=v_user) then
    raise exception using errcode='42501', message='project not found';
  end if;
  if not exists(
    select 1 from public.scenes
    where id=p_scene_id and project_id=p_project_id and user_id=v_user
  ) then
    raise exception using errcode='42501', message='scene not found';
  end if;

  select id into v_generation_id
  from public.generations
  where user_id=v_user and client_request_id=p_request_id;
  if v_generation_id is not null then return v_generation_id; end if;

  v_generation_id := gen_random_uuid();

  insert into public.generations(
    id,scene_id,project_id,user_id,provider,model,request_payload,
    status,credits_reserved,client_request_id
  )
  values(
    v_generation_id,p_scene_id,p_project_id,v_user,v_provider,p_model,
    jsonb_build_object(
      'prompt',btrim(p_prompt),
      'duration',p_duration,
      'resolution',v_resolution,
      'aspectRatio',v_ratio,
      'pricing',v_quote
    ),
    'queued',v_cost,p_request_id
  );

  perform private.reserve_generation_credits(v_user,v_generation_id,v_cost);

  insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
  values(v_user,-v_cost,'reservation',v_generation_id::text,'Generation credits reserved');

  update public.scenes
  set prompt=btrim(p_prompt), model=p_model, status='queued', updated_at=now()
  where id=p_scene_id and user_id=v_user;

  update public.projects
  set status='generating',updated_at=now()
  where id=p_project_id and user_id=v_user;

  return v_generation_id;
end;
$$;

create or replace function private.complete_generation(
  p_generation_id uuid,
  p_output_path text,
  p_output_mime_type text default 'video/mp4'
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v public.generations%rowtype;
begin
  select * into v from public.generations where id=p_generation_id for update;
  if not found then raise exception using errcode='P0002',message='generation not found'; end if;
  if v.status='succeeded' then return true; end if;
  if v.status not in ('queued','processing') then return false; end if;
  if p_output_path is null or char_length(p_output_path)>1000 then
    raise exception using errcode='22023',message='invalid output path';
  end if;

  perform private.consume_generation_credits(v.id);

  update public.generations
  set status='succeeded',
      credits_charged=v.credits_reserved,
      credits_reserved=0,
      output_path=p_output_path,
      output_mime_type=left(coalesce(p_output_mime_type,'video/mp4'),100),
      output_url=null,
      progress=100,
      provider_status='succeeded',
      completed_at=now(),
      expires_at=now()+interval '60 days',
      media_deleted_at=null,
      last_polled_at=now()
  where id=v.id;

  insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
  values(v.user_id,-v.credits_reserved,'generation',v.id::text,'Generation completed');

  update public.scenes
  set status='succeeded',active_generation_id=v.id,updated_at=now()
  where id=v.scene_id and user_id=v.user_id;

  if not exists(select 1 from public.generations where project_id=v.project_id and status in ('queued','processing')) then
    if not exists(select 1 from public.scenes where project_id=v.project_id and status<>'succeeded') then
      update public.projects set status='completed',updated_at=now()
      where id=v.project_id and user_id=v.user_id;
    else
      update public.projects set status='storyboarding',updated_at=now()
      where id=v.project_id and user_id=v.user_id;
    end if;
  end if;
  return true;
end;
$$;

create or replace function private.fail_generation(
  p_generation_id uuid,
  p_error_message text,
  p_provider_status text default 'failed'
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v public.generations%rowtype;
begin
  select * into v from public.generations where id=p_generation_id for update;
  if not found then return false; end if;
  if v.status in ('succeeded','failed','cancelled') then return v.status='failed'; end if;

  if p_provider_status not in ('confirmed_refundable','billed_failure') then
    update public.generations
      set provider_status='billing_review',
          error_message=left(coalesce(p_error_message,'Billing review required'),1000),
          last_polled_at=now()
      where id=v.id;
    return false;
  end if;

  if p_provider_status='billed_failure' then
    perform private.consume_generation_credits(v.id);
  else
    perform private.release_generation_credits(v.id);
  end if;

  update public.generations
  set status='failed',
      credits_charged=case when p_provider_status='billed_failure' then v.credits_reserved else 0 end,
      credits_reserved=0,
      error_message=left(coalesce(p_error_message,'Generation failed'),1000),
      provider_status=left(coalesce(p_provider_status,'failed'),80),
      completed_at=now(),
      last_polled_at=now()
  where id=v.id;

  insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
  values(
    v.user_id,
    case when p_provider_status='billed_failure' then -v.credits_reserved else v.credits_reserved end,
    case when p_provider_status='billed_failure' then 'generation' else 'refund' end,
    v.id::text,
    'Provider failure billing settled'
  );

  update public.scenes set status='failed',updated_at=now()
  where id=v.scene_id and user_id=v.user_id;

  if not exists(select 1 from public.generations where project_id=v.project_id and status in ('queued','processing')) then
    update public.projects set status='storyboarding',updated_at=now()
    where id=v.project_id and user_id=v.user_id;
  end if;
  return true;
end;
$$;

create or replace function private.cancel_generation(p_generation_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_credits integer;
  v_project uuid;
  v_scene uuid;
begin
  if v_user is null then
    raise exception using errcode='28000',message='authentication required';
  end if;

  select credits_reserved,project_id,scene_id
  into v_credits,v_project,v_scene
  from public.generations
  where id=p_generation_id and user_id=v_user and status='queued'
  for update;

  if not found then
    raise exception using errcode='P0001',message='queued generation not found';
  end if;

  perform private.release_generation_credits(p_generation_id);

  update public.generations
    set status='cancelled',credits_reserved=0,completed_at=now()
    where id=p_generation_id;

  update public.scenes set status='cancelled',updated_at=now()
  where id=v_scene and user_id=v_user;

  insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
  values(v_user,v_credits,'refund',p_generation_id::text,'Queued generation cancelled');

  if not exists(
    select 1 from public.generations
    where project_id=v_project and user_id=v_user and status in ('queued','processing')
  ) then
    update public.projects set status='storyboarding',updated_at=now()
    where id=v_project and user_id=v_user;
  end if;
  return true;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.profiles(user_id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case
      when lower(coalesce(new.email, '')) in (
        'tntr24795@gmail.com',
        'founder@pensrikris36.com',
        'than.smart88@gmail.com'
      ) then 'admin'
      else 'user'
    end
  );

  insert into public.credit_wallets(user_id,balance,reserved)
  values(new.id,0,0)
  on conflict(user_id) do nothing;

  perform private.grant_credit_bucket(
    new.id,
    'welcome',
    'welcome:'||new.id::text,
    100,
    null,
    'Welcome credits',
    jsonb_build_object('welcome',true)
  );

  return new;
end;
$$;

do $$
declare r record;
begin
  for r in select user_id from public.credit_wallets loop
    perform private.sync_credit_wallet(r.user_id);
  end loop;
end $$;

revoke all on function public.reserve_credits(integer,text) from public,anon,authenticated;
