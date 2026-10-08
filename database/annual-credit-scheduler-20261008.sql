alter table public.subscriptions
  add column if not exists credit_cycles_granted integer not null default 0,
  add column if not exists next_credit_grant_at timestamptz;

create or replace function public.configure_subscription_credit_schedule(
  p_user_id uuid,
  p_subscription_id uuid,
  p_interval text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_monthly_credits integer,
  p_first_cycle_bonus integer default 0
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_first_credits integer;
  v_next timestamptz;
begin
  if p_interval not in ('month','year') then raise exception 'unsupported billing interval'; end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'invalid subscription period';
  end if;
  if p_monthly_credits <= 0 or p_first_cycle_bonus < 0 then
    raise exception 'invalid credit allowance';
  end if;

  update public.subscriptions
  set billing_interval=p_interval,
      current_period_start=p_period_start,
      current_period_end=p_period_end,
      monthly_credit_amount=p_monthly_credits,
      credit_anchor_day=extract(day from p_period_start)::smallint,
      credit_cycles_granted=0,
      next_credit_grant_at=p_period_start,
      updated_at=now()
  where id=p_subscription_id and user_id=p_user_id;

  if not found then raise exception 'subscription not found'; end if;

  v_first_credits := p_monthly_credits + p_first_cycle_bonus;

  perform private.expire_due_credit_buckets(p_user_id,p_period_start);

  perform private.grant_credit_bucket(
    p_user_id,
    case when p_interval='month' then 'subscription_monthly' else 'subscription_annual' end,
    'subscription:'||p_subscription_id::text||':cycle:1',
    v_first_credits,
    p_period_end,
    case when p_interval='month'
      then 'Monthly subscription cycle 1'
      else 'Annual subscription month 1'
    end,
    jsonb_build_object(
      'subscription_id',p_subscription_id,
      'billing_interval',p_interval,
      'cycle',1,
      'base_credits',p_monthly_credits,
      'bonus_credits',p_first_cycle_bonus,
      'period_start',p_period_start,
      'period_end',p_period_end
    )
  );

  if p_interval='year' then
    v_next := p_period_start + interval '1 month';
    update public.subscriptions
      set credit_cycles_granted=1,
          next_credit_grant_at=case when v_next < p_period_end then v_next else null end,
          updated_at=now()
      where id=p_subscription_id and user_id=p_user_id;
  else
    update public.subscriptions
      set credit_cycles_granted=1,
          next_credit_grant_at=null,
          updated_at=now()
      where id=p_subscription_id and user_id=p_user_id;
  end if;
end;
$$;
revoke all on function public.configure_subscription_credit_schedule(uuid,uuid,text,timestamptz,timestamptz,integer,integer) from public,anon,authenticated;
grant execute on function public.configure_subscription_credit_schedule(uuid,uuid,text,timestamptz,timestamptz,integer,integer) to service_role;

create or replace function private.grant_due_annual_credit_cycles()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_sub record;
  v_granted integer := 0;
  v_cycle integer;
  v_due timestamptz;
begin
  for v_sub in
    select *
    from public.subscriptions
    where billing_interval='year'
      and status in ('active','trialing')
      and current_period_start is not null
      and current_period_end is not null
      and monthly_credit_amount is not null
      and monthly_credit_amount > 0
      and next_credit_grant_at is not null
      and next_credit_grant_at <= now()
      and next_credit_grant_at < current_period_end
    for update
  loop
    loop
      v_cycle := v_sub.credit_cycles_granted + 1;
      exit when v_cycle > 12;

      v_due := v_sub.current_period_start + ((v_cycle - 1)::text || ' months')::interval;
      exit when v_due > now() or v_due >= v_sub.current_period_end;

      perform private.grant_credit_bucket(
        v_sub.user_id,
        'subscription_annual',
        'subscription:'||v_sub.id::text||':cycle:'||v_cycle::text,
        v_sub.monthly_credit_amount,
        v_sub.current_period_end,
        'Annual subscription month '||v_cycle::text,
        jsonb_build_object(
          'subscription_id',v_sub.id,
          'billing_interval','year',
          'cycle',v_cycle,
          'period_start',v_sub.current_period_start,
          'period_end',v_sub.current_period_end
        )
      );

      v_sub.credit_cycles_granted := v_cycle;
      v_granted := v_granted + 1;
    end loop;

    v_due := v_sub.current_period_start + (v_sub.credit_cycles_granted::text || ' months')::interval;
    update public.subscriptions
    set credit_cycles_granted=v_sub.credit_cycles_granted,
        next_credit_grant_at=case when v_due < current_period_end and v_sub.credit_cycles_granted < 12 then v_due else null end,
        updated_at=now()
    where id=v_sub.id;
  end loop;

  return v_granted;
end;
$$;
revoke all on function private.grant_due_annual_credit_cycles() from public,anon,authenticated;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='pixenar-grant-annual-credits-hourly' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'pixenar-grant-annual-credits-hourly',
    '7 * * * *',
    'select private.grant_due_annual_credit_cycles();'
  );
end $$;
